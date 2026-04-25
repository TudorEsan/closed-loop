/**
 * HTTP integration tests for the Bracelets module.
 *
 * Requires Docker to be running on the host. Spins up a real Postgres
 * container via Testcontainers, applies the full Drizzle schema, then boots
 * the Nest application against it. The global AuthGuard is overridden so
 * each test can attach an arbitrary user to the request without going
 * through Better Auth.
 *
 * If Docker is not available, the suite prints a clear message and skips
 * itself. Run with: `pnpm test:e2e bracelets`.
 */

import { Test } from '@nestjs/testing';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
import {
  startTestDatabase,
  stopTestDatabase,
  truncateAll,
  TestDb,
} from './helpers/db';
import {
  fakeWristbandUid,
  seedEvent,
  seedEventMember,
  seedUser,
} from './helpers/seed';
import { auditLogs, eventBracelets } from '../src/common/database/schemas';

// Stub Better Auth before any module that imports it loads. The real
// implementation pulls in ESM-only deps and contacts a database in its
// module init; for HTTP integration tests we override the AuthGuard so
// none of that machinery runs.
jest.mock('../src/common/auth/auth', () => ({
  auth: { api: { getSession: async () => null } },
}));

// Decide whether to run the suite at module load time. If Docker is not
// reachable we skip every test in this file and print a hint instead of
// erroring out — most CI machines without Docker should still pass.
const dockerAvailable = (): boolean => {
  try {
    require('child_process').execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const HAS_DOCKER = dockerAvailable();

const describeIfDocker = HAS_DOCKER ? describe : describe.skip;

if (!HAS_DOCKER) {
  console.warn(
    '[bracelets.e2e-spec] Docker is not available on this host, skipping the suite. ' +
      'Start Docker Desktop and re-run `pnpm test:e2e bracelets` to execute these tests.',
  );
}

// Identity the AuthGuard mock will attach to every request. We mutate this
// object between tests instead of rebuilding the Nest app, which is several
// seconds per test otherwise.
type ActingUser = { id: string; role: string };
let actingUser: ActingUser | null = null;

const makeAuthGuardMock = (): CanActivate => ({
  canActivate(ctx: ExecutionContext) {
    if (!actingUser) return false;
    const req = ctx.switchToHttp().getRequest();
    req.user = actingUser;
    return true;
  },
});

describeIfDocker('/API bracelets', () => {
  jest.setTimeout(120_000);

  let testDb: TestDb;
  let app: INestApplication<App>;
  let http: App;
  let braceletTokenService: import('../src/modules/bracelets/bracelet-token.service').BraceletTokenService;

  beforeAll(async () => {
    testDb = await startTestDatabase();

    // Wire env BEFORE AppModule is required, otherwise its config
    // validation will trip on the missing DATABASE_URL.
    process.env.DATABASE_URL = testDb.url;
    process.env.BRACELET_SIGNING_KEY = faker.string.alphanumeric(48);
    process.env.BRACELET_TOKEN_GRACE_HOURS = '48';
    process.env.NODE_ENV = 'test';
    // Better Auth, Stripe and Resend are not exercised by these tests but
    // their modules read env at import time. Provide harmless placeholders.
    process.env.RESEND_API_KEY =
      process.env.RESEND_API_KEY ?? 'test_resend_key';
    process.env.STRIPE_SECRET_KEY =
      process.env.STRIPE_SECRET_KEY ?? 'sk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET =
      process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test';
    process.env.STRIPE_PUBLISHABLE_KEY =
      process.env.STRIPE_PUBLISHABLE_KEY ?? 'pk_test_dummy';

    const { AppModule } = await import('../src/app.module');
    const { BraceletTokenService } =
      await import('../src/modules/bracelets/bracelet-token.service');
    const { AuthGuard } = await import('../src/common/guards/auth.guard');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AuthGuard)
      .useValue(makeAuthGuardMock())
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    http = app.getHttpServer();

    braceletTokenService = app.get(BraceletTokenService);
  });

  afterAll(async () => {
    if (app) await app.close();
    await stopTestDatabase(testDb);
  });

  beforeEach(async () => {
    actingUser = null;
    await truncateAll(testDb);
  });

  describe('POST /events/:eventId/bracelets', () => {
    it('link, given valid super_admin and unused uid, persists active assignment and returns 201 with a verifiable token', async () => {
      const superAdmin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, superAdmin.id);
      const target = await seedUser(testDb, { role: 'attendee' });
      const uid = fakeWristbandUid();
      actingUser = { id: superAdmin.id, role: superAdmin.role };

      const response = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: target.id, wristbandUid: uid });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        eventId: event.id,
        userId: target.id,
        wristbandUid: uid,
        status: 'active',
      });
      expect(typeof response.body.token).toBe('string');
      const decoded = braceletTokenService.verify(response.body.token, {
        eventId: event.id,
      });
      expect(decoded.assignmentId).toBe(response.body.id);
      expect(decoded.userId).toBe(target.id);
      expect(decoded.wristbandUid).toBe(uid);

      const persisted = await testDb.drizzle
        .select()
        .from(eventBracelets)
        .where(eq(eventBracelets.id, response.body.id));
      expect(persisted).toHaveLength(1);
      expect(persisted[0].status).toBe('active');
    });

    it('link, when uid is already active for the event, returns 409', async () => {
      const superAdmin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, superAdmin.id);
      const userA = await seedUser(testDb);
      const userB = await seedUser(testDb);
      const uid = fakeWristbandUid();
      actingUser = { id: superAdmin.id, role: superAdmin.role };

      const first = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: userA.id, wristbandUid: uid });
      expect(first.status).toBe(201);

      const second = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: userB.id, wristbandUid: uid });

      expect(second.status).toBe(409);
    });

    it('link, when same user already has an active assignment for the event, returns 409', async () => {
      const superAdmin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, superAdmin.id);
      const target = await seedUser(testDb);
      actingUser = { id: superAdmin.id, role: superAdmin.role };

      const first = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: target.id, wristbandUid: fakeWristbandUid() });
      expect(first.status).toBe(201);

      const second = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: target.id, wristbandUid: fakeWristbandUid() });

      expect(second.status).toBe(409);
    });

    it('link, when caller has operator role, returns 403', async () => {
      const superAdmin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, superAdmin.id);
      const operator = await seedUser(testDb, { role: 'operator' });
      const target = await seedUser(testDb);
      actingUser = { id: operator.id, role: operator.role };

      const response = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: target.id, wristbandUid: fakeWristbandUid() });

      expect(response.status).toBe(403);
    });

    it('link, when admin is not member of the event, returns 403', async () => {
      const organizer = await seedUser(testDb, { role: 'admin' });
      const outsider = await seedUser(testDb, { role: 'admin' });
      const event = await seedEvent(testDb, organizer.id);
      const target = await seedUser(testDb);
      actingUser = { id: outsider.id, role: outsider.role };

      const response = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: target.id, wristbandUid: fakeWristbandUid() });

      expect(response.status).toBe(403);
    });

    it('link, when target user is inactive, returns 400', async () => {
      const superAdmin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, superAdmin.id);
      const inactive = await seedUser(testDb, { isActive: false });
      actingUser = { id: superAdmin.id, role: superAdmin.role };

      const response = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: inactive.id, wristbandUid: fakeWristbandUid() });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /events/:eventId/bracelets/:id/revoke', () => {
    it('revoke, given an active assignment, marks status revoked and writes an audit log row', async () => {
      const superAdmin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, superAdmin.id);
      const target = await seedUser(testDb);
      actingUser = { id: superAdmin.id, role: superAdmin.role };
      const created = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: target.id, wristbandUid: fakeWristbandUid() });
      expect(created.status).toBe(201);
      const reason = faker.lorem.sentence();

      const response = await request(http)
        .patch(`/api/v1/events/${event.id}/bracelets/${created.body.id}/revoke`)
        .send({ reason });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('revoked');
      const stored = await testDb.drizzle
        .select()
        .from(eventBracelets)
        .where(eq(eventBracelets.id, created.body.id));
      expect(stored[0].status).toBe('revoked');
      expect(stored[0].revokedBy).toBe(superAdmin.id);
      const audit = await testDb.drizzle
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityId, created.body.id),
            eq(auditLogs.action, 'bracelet.revoke'),
          ),
        );
      expect(audit).toHaveLength(1);
      expect(audit[0].userId).toBe(superAdmin.id);
    });
  });

  describe('POST /events/:eventId/bracelets/:id/replace', () => {
    it('replace, given an active assignment, marks the old one replaced and creates a new active assignment for the same user in one transaction', async () => {
      const superAdmin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, superAdmin.id);
      const target = await seedUser(testDb);
      actingUser = { id: superAdmin.id, role: superAdmin.role };
      const oldUid = fakeWristbandUid();
      const newUid = fakeWristbandUid();
      const created = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: target.id, wristbandUid: oldUid });
      expect(created.status).toBe(201);

      const response = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets/${created.body.id}/replace`)
        .send({ wristbandUid: newUid, reason: 'lost' });

      expect(response.status).toBe(201);
      expect(response.body.previous.id).toBe(created.body.id);
      expect(response.body.previous.status).toBe('replaced');
      expect(response.body.current.userId).toBe(target.id);
      expect(response.body.current.wristbandUid).toBe(newUid);
      expect(response.body.current.status).toBe('active');
      expect(typeof response.body.current.token).toBe('string');
      const old = await testDb.drizzle
        .select()
        .from(eventBracelets)
        .where(eq(eventBracelets.id, created.body.id));
      expect(old[0].status).toBe('replaced');
      expect(old[0].replacedByAssignmentId).toBe(response.body.current.id);
    });
  });

  describe('GET /events/:eventId/bracelets/sync-bundle', () => {
    it('syncBundle, given a mix of active and revoked, returns only active assignments each with a verifiable token', async () => {
      const superAdmin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, superAdmin.id);
      const userA = await seedUser(testDb);
      const userB = await seedUser(testDb);
      actingUser = { id: superAdmin.id, role: superAdmin.role };
      const activeOne = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: userA.id, wristbandUid: fakeWristbandUid() });
      const willBeRevoked = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: userB.id, wristbandUid: fakeWristbandUid() });
      await request(http)
        .patch(
          `/api/v1/events/${event.id}/bracelets/${willBeRevoked.body.id}/revoke`,
        )
        .send({ reason: 'test' });

      const response = await request(http).get(
        `/api/v1/events/${event.id}/bracelets/sync-bundle`,
      );

      expect(response.status).toBe(200);
      expect(response.body.eventId).toBe(event.id);
      expect(Array.isArray(response.body.assignments)).toBe(true);
      const ids = response.body.assignments.map((a: { id: string }) => a.id);
      expect(ids).toContain(activeOne.body.id);
      expect(ids).not.toContain(willBeRevoked.body.id);
      for (const assignment of response.body.assignments) {
        expect(assignment.status).toBe('active');
        expect(typeof assignment.token).toBe('string');
        const decoded = braceletTokenService.verify(assignment.token, {
          eventId: event.id,
        });
        expect(decoded.assignmentId).toBe(assignment.id);
      }
    });
  });

  describe('GET /events/:eventId/bracelets/by-uid/:uid', () => {
    it('findByUid, when an active assignment exists for the uid, returns it with a token', async () => {
      const superAdmin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, superAdmin.id);
      const target = await seedUser(testDb);
      actingUser = { id: superAdmin.id, role: superAdmin.role };
      const uid = fakeWristbandUid();
      const created = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: target.id, wristbandUid: uid });
      expect(created.status).toBe(201);

      const response = await request(http).get(
        `/api/v1/events/${event.id}/bracelets/by-uid/${uid}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(created.body.id);
      expect(response.body.wristbandUid).toBe(uid);
      expect(response.body.status).toBe('active');
      expect(typeof response.body.token).toBe('string');
      const decoded = braceletTokenService.verify(response.body.token, {
        eventId: event.id,
      });
      expect(decoded.wristbandUid).toBe(uid);
    });

    it('findByUid, when the assignment for the uid was revoked, returns 404', async () => {
      const superAdmin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, superAdmin.id);
      const target = await seedUser(testDb);
      actingUser = { id: superAdmin.id, role: superAdmin.role };
      const uid = fakeWristbandUid();
      const created = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: target.id, wristbandUid: uid });
      expect(created.status).toBe(201);
      const revoked = await request(http)
        .patch(`/api/v1/events/${event.id}/bracelets/${created.body.id}/revoke`)
        .send({ reason: 'lost' });
      expect(revoked.status).toBe(200);

      const response = await request(http).get(
        `/api/v1/events/${event.id}/bracelets/by-uid/${uid}`,
      );

      expect(response.status).toBe(404);
    });
  });

  describe('event_members admin path', () => {
    it('link, when admin is a member of the event with role admin, succeeds', async () => {
      const organizer = await seedUser(testDb, { role: 'admin' });
      const eventAdmin = await seedUser(testDb, { role: 'admin' });
      const event = await seedEvent(testDb, organizer.id);
      await seedEventMember(testDb, event.id, eventAdmin.id, 'admin');
      const target = await seedUser(testDb);
      actingUser = { id: eventAdmin.id, role: eventAdmin.role };

      const response = await request(http)
        .post(`/api/v1/events/${event.id}/bracelets`)
        .send({ userId: target.id, wristbandUid: fakeWristbandUid() });

      expect(response.status).toBe(201);
    });
  });
});
