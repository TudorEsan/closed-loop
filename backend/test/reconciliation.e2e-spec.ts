/**
 * HTTP integration tests for the Reconciliation module.
 *
 * Spins up a real Postgres container, applies the Drizzle schema, then boots
 * Nest and hits POST /events/:eventId/wristbands/:wristbandUid/sync from
 * supertest. AuthGuard is overridden so the acting user can be any seeded
 * row.
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
import { eq } from 'drizzle-orm';
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
import {
  eventBracelets,
  transactions,
  vendors,
} from '../src/common/database/schemas';

jest.mock('../src/common/auth/auth', () => ({
  auth: { api: { getSession: async () => null } },
}));

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
    '[reconciliation.e2e-spec] Docker is not available, skipping the suite.',
  );
}

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

const seedBracelet = async (
  db: TestDb,
  eventId: string,
  userId: string,
  linkedBy: string,
  balance = 0,
) => {
  const id = faker.string.uuid();
  const wristbandUid = fakeWristbandUid();
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.drizzle.insert(eventBracelets).values({
    id,
    eventId,
    userId,
    wristbandUid,
    linkedBy,
    tokenExpiresAt,
    balance,
  });
  return { id, wristbandUid };
};

const seedVendor = async (db: TestDb, eventId: string, userId: string) => {
  const id = faker.string.uuid();
  await db.drizzle.insert(vendors).values({
    id,
    userId,
    eventId,
    businessName: faker.company.name(),
    contactPerson: faker.person.fullName(),
    contactEmail: faker.internet.email().toLowerCase(),
    productType: 'food',
    status: 'approved',
  });
  return { id };
};

describeIfDocker('/API reconciliation', () => {
  jest.setTimeout(120_000);

  let testDb: TestDb;
  let app: INestApplication<App>;
  let http: App;

  beforeAll(async () => {
    testDb = await startTestDatabase();

    process.env.DATABASE_URL = testDb.url;
    process.env.BRACELET_SIGNING_KEY = faker.string.alphanumeric(48);
    process.env.BRACELET_TOKEN_GRACE_HOURS = '48';
    process.env.NODE_ENV = 'test';
    process.env.RESEND_API_KEY =
      process.env.RESEND_API_KEY ?? 'test_resend_key';
    process.env.STRIPE_SECRET_KEY =
      process.env.STRIPE_SECRET_KEY ?? 'sk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET =
      process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test';
    process.env.STRIPE_PUBLISHABLE_KEY =
      process.env.STRIPE_PUBLISHABLE_KEY ?? 'pk_test_dummy';

    const { AppModule } = await import('../src/app.module');
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
  });

  afterAll(async () => {
    if (app) await app.close();
    await stopTestDatabase(testDb);
  });

  beforeEach(async () => {
    actingUser = null;
    await truncateAll(testDb);
  });

  describe('POST /events/:eventId/wristbands/:uid/sync', () => {
    it('happy path: applies all pending debits and returns chip-write directive', async () => {
      const admin = await seedUser(testDb, { role: 'super_admin' });
      const attendee = await seedUser(testDb);
      const event = await seedEvent(testDb, admin.id);
      await seedEventMember(testDb, event.id, admin.id, 'admin');
      const vendor = await seedVendor(testDb, event.id, admin.id);
      const bracelet = await seedBracelet(
        testDb,
        event.id,
        attendee.id,
        admin.id,
        10000,
      );
      actingUser = { id: admin.id, role: admin.role };

      const debits = [
        {
          idempotencyKey: faker.string.uuid(),
          amount: 1500,
          vendorId: vendor.id,
          counterValue: 1,
          deviceId: 'pos-1',
          clientTimestamp: new Date().toISOString(),
        },
        {
          idempotencyKey: faker.string.uuid(),
          amount: 500,
          vendorId: vendor.id,
          counterValue: 2,
          deviceId: 'pos-1',
          clientTimestamp: new Date().toISOString(),
        },
      ];

      const response = await request(http)
        .post(
          `/api/v1/events/${event.id}/wristbands/${bracelet.wristbandUid}/sync`,
        )
        .send({
          pendingDebits: debits,
        });

      expect(response.status).toBe(201);
      expect(response.body.applied).toEqual([
        debits[0].idempotencyKey,
        debits[1].idempotencyKey,
      ]);
      expect(response.body.rejected).toEqual([]);
      expect(response.body.serverState.balance).toBe(8000);
      expect(response.body.serverState.debit_counter_seen).toBe(2);
      expect(response.body.chipShouldWrite.balance).toBe(8000);

      const stored = await testDb.drizzle
        .select()
        .from(transactions)
        .where(eq(transactions.eventBraceletId, bracelet.id));
      expect(stored).toHaveLength(2);
      expect(stored.every((t) => t.offline === true)).toBe(true);
      expect(stored.every((t) => t.type === 'debit')).toBe(true);
    });

    it('duplicate idempotencyKey is recorded once and rejected on retry', async () => {
      const admin = await seedUser(testDb, { role: 'super_admin' });
      const attendee = await seedUser(testDb);
      const event = await seedEvent(testDb, admin.id);
      const vendor = await seedVendor(testDb, event.id, admin.id);
      const bracelet = await seedBracelet(
        testDb,
        event.id,
        attendee.id,
        admin.id,
        5000,
      );
      actingUser = { id: admin.id, role: admin.role };

      const debit = {
        idempotencyKey: faker.string.uuid(),
        amount: 1000,
        vendorId: vendor.id,
        counterValue: 1,
        deviceId: 'pos-1',
        clientTimestamp: new Date().toISOString(),
      };

      const first = await request(http)
        .post(
          `/api/v1/events/${event.id}/wristbands/${bracelet.wristbandUid}/sync`,
        )
        .send({
          pendingDebits: [debit],
        });
      expect(first.status).toBe(201);
      expect(first.body.applied).toEqual([debit.idempotencyKey]);

      const second = await request(http)
        .post(
          `/api/v1/events/${event.id}/wristbands/${bracelet.wristbandUid}/sync`,
        )
        .send({
          pendingDebits: [debit],
        });
      expect(second.status).toBe(201);
      expect(second.body.applied).toEqual([]);
      expect(second.body.rejected).toEqual([
        { idempotencyKey: debit.idempotencyKey, reason: 'duplicate' },
      ]);
      expect(second.body.serverState.balance).toBe(4000);
    });

    it('late counter is recorded as historical without mutating balance', async () => {
      const admin = await seedUser(testDb, { role: 'super_admin' });
      const attendee = await seedUser(testDb);
      const event = await seedEvent(testDb, admin.id);
      const vendor = await seedVendor(testDb, event.id, admin.id);
      const bracelet = await seedBracelet(
        testDb,
        event.id,
        attendee.id,
        admin.id,
        5000,
      );
      // Pre-bump debit_counter_seen to 5
      await testDb.drizzle
        .update(eventBracelets)
        .set({ debitCounterSeen: 5 })
        .where(eq(eventBracelets.id, bracelet.id));
      actingUser = { id: admin.id, role: admin.role };

      const debit = {
        idempotencyKey: faker.string.uuid(),
        amount: 1000,
        vendorId: vendor.id,
        counterValue: 3,
        deviceId: 'pos-1',
        clientTimestamp: new Date().toISOString(),
      };

      const response = await request(http)
        .post(
          `/api/v1/events/${event.id}/wristbands/${bracelet.wristbandUid}/sync`,
        )
        .send({
          pendingDebits: [debit],
        });

      expect(response.status).toBe(201);
      expect(response.body.applied).toEqual([debit.idempotencyKey]);
      expect(response.body.rejected).toEqual([]);
      expect(response.body.serverState.balance).toBe(5000);
    });

    it('insufficient funds rejects the offending debit but applies earlier debits', async () => {
      const admin = await seedUser(testDb, { role: 'super_admin' });
      const attendee = await seedUser(testDb);
      const event = await seedEvent(testDb, admin.id);
      const vendor = await seedVendor(testDb, event.id, admin.id);
      const bracelet = await seedBracelet(
        testDb,
        event.id,
        attendee.id,
        admin.id,
        2000,
      );
      actingUser = { id: admin.id, role: admin.role };

      const debits = [
        {
          idempotencyKey: faker.string.uuid(),
          amount: 1500,
          vendorId: vendor.id,
          counterValue: 1,
          deviceId: 'pos-1',
          clientTimestamp: new Date().toISOString(),
        },
        {
          idempotencyKey: faker.string.uuid(),
          amount: 1000,
          vendorId: vendor.id,
          counterValue: 2,
          deviceId: 'pos-1',
          clientTimestamp: new Date().toISOString(),
        },
      ];

      const response = await request(http)
        .post(
          `/api/v1/events/${event.id}/wristbands/${bracelet.wristbandUid}/sync`,
        )
        .send({
          pendingDebits: debits,
        });

      expect(response.status).toBe(201);
      expect(response.body.applied).toEqual([debits[0].idempotencyKey]);
      expect(response.body.rejected).toEqual([
        {
          idempotencyKey: debits[1].idempotencyKey,
          reason: 'insufficient_funds',
        },
      ]);
      expect(response.body.serverState.balance).toBe(500);
    });

    it('out of order debits are sorted by counterValue before applying', async () => {
      const admin = await seedUser(testDb, { role: 'super_admin' });
      const attendee = await seedUser(testDb);
      const event = await seedEvent(testDb, admin.id);
      const vendor = await seedVendor(testDb, event.id, admin.id);
      const bracelet = await seedBracelet(
        testDb,
        event.id,
        attendee.id,
        admin.id,
        10000,
      );
      actingUser = { id: admin.id, role: admin.role };

      const k1 = faker.string.uuid();
      const k2 = faker.string.uuid();
      const k3 = faker.string.uuid();
      const debits = [
        {
          idempotencyKey: k3,
          amount: 100,
          vendorId: vendor.id,
          counterValue: 3,
          deviceId: 'pos-1',
          clientTimestamp: new Date().toISOString(),
        },
        {
          idempotencyKey: k1,
          amount: 200,
          vendorId: vendor.id,
          counterValue: 1,
          deviceId: 'pos-1',
          clientTimestamp: new Date().toISOString(),
        },
        {
          idempotencyKey: k2,
          amount: 300,
          vendorId: vendor.id,
          counterValue: 2,
          deviceId: 'pos-1',
          clientTimestamp: new Date().toISOString(),
        },
      ];

      const response = await request(http)
        .post(
          `/api/v1/events/${event.id}/wristbands/${bracelet.wristbandUid}/sync`,
        )
        .send({
          pendingDebits: debits,
        });

      expect(response.status).toBe(201);
      expect(response.body.applied).toEqual([k1, k2, k3]);
      expect(response.body.serverState.debit_counter_seen).toBe(3);
      expect(response.body.serverState.balance).toBe(9400);
    });

    it('returns 404 when no active bracelet matches the uid', async () => {
      const admin = await seedUser(testDb, { role: 'super_admin' });
      const event = await seedEvent(testDb, admin.id);
      actingUser = { id: admin.id, role: admin.role };

      const response = await request(http)
        .post(
          `/api/v1/events/${event.id}/wristbands/${fakeWristbandUid()}/sync`,
        )
        .send({
          pendingDebits: [],
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /events/:eventId/vendors/:vendorId/transactions/charge', () => {
    it('uses trusted chip debit state when the chip is ahead of the server', async () => {
      const admin = await seedUser(testDb, { role: 'super_admin' });
      const attendee = await seedUser(testDb);
      const event = await seedEvent(testDb, admin.id);
      const vendor = await seedVendor(testDb, event.id, admin.id);
      const bracelet = await seedBracelet(
        testDb,
        event.id,
        attendee.id,
        admin.id,
        10000,
      );
      actingUser = { id: admin.id, role: admin.role };

      const response = await request(http)
        .post(
          `/api/v1/events/${event.id}/vendors/${vendor.id}/transactions/charge`,
        )
        .send({
          wristbandUid: bracelet.wristbandUid,
          amount: 2000,
          deviceId: 'pos-1',
          idempotencyKey: faker.string.uuid(),
          chipState: {
            balance: 7000,
            debit_counter: 1,
            credit_counter_seen: 0,
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.bracelet.balance).toBe(5000);
      expect(response.body.bracelet.debit_counter_seen).toBe(2);
      expect(response.body.chipShouldWrite.balance).toBe(5000);

      const [storedBracelet] = await testDb.drizzle
        .select()
        .from(eventBracelets)
        .where(eq(eventBracelets.id, bracelet.id));
      expect(storedBracelet.balance).toBe(5000);
      expect(storedBracelet.debitCounterSeen).toBe(2);

      const [storedTx] = await testDb.drizzle
        .select()
        .from(transactions)
        .where(eq(transactions.eventBraceletId, bracelet.id));
      expect(storedTx.amount).toBe(2000);
      expect(storedTx.offline).toBe(false);
      expect(storedTx.debitCounter).toBe(2);
      expect(storedTx.metadata).toMatchObject({
        deviceId: 'pos-1',
        chipReconciliation: {
          serverBalanceBefore: 10000,
          serverDebitCounterSeenBefore: 0,
          chipBalance: 7000,
          chipDebitCounter: 1,
          chipCreditCounterSeen: 0,
          unseenCreditsApplied: 0,
        },
      });
    });

    it('rejects spend above chip balance when the chip is ahead', async () => {
      const admin = await seedUser(testDb, { role: 'super_admin' });
      const attendee = await seedUser(testDb);
      const event = await seedEvent(testDb, admin.id);
      const vendor = await seedVendor(testDb, event.id, admin.id);
      const bracelet = await seedBracelet(
        testDb,
        event.id,
        attendee.id,
        admin.id,
        10000,
      );
      actingUser = { id: admin.id, role: admin.role };

      const response = await request(http)
        .post(
          `/api/v1/events/${event.id}/vendors/${vendor.id}/transactions/charge`,
        )
        .send({
          wristbandUid: bracelet.wristbandUid,
          amount: 9000,
          deviceId: 'pos-1',
          idempotencyKey: faker.string.uuid(),
          chipState: {
            balance: 7000,
            debit_counter: 1,
            credit_counter_seen: 0,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Insufficient funds');

      const [storedBracelet] = await testDb.drizzle
        .select()
        .from(eventBracelets)
        .where(eq(eventBracelets.id, bracelet.id));
      expect(storedBracelet.balance).toBe(10000);
      expect(storedBracelet.debitCounterSeen).toBe(0);
    });

    it('later sync records already absorbed offline debits without mutating balance again', async () => {
      const admin = await seedUser(testDb, { role: 'super_admin' });
      const attendee = await seedUser(testDb);
      const event = await seedEvent(testDb, admin.id);
      const vendor = await seedVendor(testDb, event.id, admin.id);
      const bracelet = await seedBracelet(
        testDb,
        event.id,
        attendee.id,
        admin.id,
        10000,
      );
      actingUser = { id: admin.id, role: admin.role };

      await request(http)
        .post(
          `/api/v1/events/${event.id}/vendors/${vendor.id}/transactions/charge`,
        )
        .send({
          wristbandUid: bracelet.wristbandUid,
          amount: 2000,
          deviceId: 'pos-1',
          idempotencyKey: faker.string.uuid(),
          chipState: {
            balance: 7000,
            debit_counter: 1,
            credit_counter_seen: 0,
          },
        })
        .expect(201);

      const pendingDebit = {
        idempotencyKey: faker.string.uuid(),
        amount: 3000,
        vendorId: vendor.id,
        counterValue: 1,
        deviceId: 'pos-1',
        clientTimestamp: new Date().toISOString(),
      };

      const sync = await request(http)
        .post(
          `/api/v1/events/${event.id}/wristbands/${bracelet.wristbandUid}/sync`,
        )
        .send({
          pendingDebits: [pendingDebit],
        });

      expect(sync.status).toBe(201);
      expect(sync.body.applied).toEqual([pendingDebit.idempotencyKey]);
      expect(sync.body.rejected).toEqual([]);
      expect(sync.body.serverState.balance).toBe(5000);
      expect(sync.body.serverState.debit_counter_seen).toBe(2);

      const stored = await testDb.drizzle
        .select()
        .from(transactions)
        .where(eq(transactions.eventBraceletId, bracelet.id));
      const historical = stored.find(
        (tx) => tx.idempotencyKey === pendingDebit.idempotencyKey,
      );
      expect(historical).toMatchObject({
        amount: 3000,
        offline: true,
        debitCounter: 1,
        metadata: {
          deviceId: 'pos-1',
          balanceMutation: 'already_absorbed',
        },
      });
    });
  });
});
