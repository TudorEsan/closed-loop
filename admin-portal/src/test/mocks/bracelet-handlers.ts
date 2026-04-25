import { faker } from '@faker-js/faker';
import { http, HttpResponse } from 'msw';

import type { BraceletAssignment, User } from '@/types';

const API = 'http://localhost:3000/api/v1';

export const braceletStore = {
  bracelets: [] as BraceletAssignment[],
  users: [] as User[],
};

export function resetBraceletStore() {
  braceletStore.bracelets = [];
  braceletStore.users = [];
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    role: 'attendee',
    isActive: true,
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeBracelet(
  overrides: Partial<BraceletAssignment> = {},
  user?: User,
): BraceletAssignment {
  const linkedUser = user ?? makeUser();
  const now = new Date().toISOString();
  return {
    id: faker.string.uuid(),
    eventId: faker.string.uuid(),
    userId: linkedUser.id,
    wristbandUid: `04:${faker.string.alphanumeric({ length: 2, casing: 'upper' })}:${faker.string.alphanumeric({ length: 2, casing: 'upper' })}:${faker.string.alphanumeric({ length: 2, casing: 'upper' })}:${faker.string.alphanumeric({ length: 2, casing: 'upper' })}`,
    status: 'active',
    linkedAt: now,
    linkedBy: faker.string.uuid(),
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    replacedByAssignmentId: null,
    tokenIssuedAt: now,
    tokenExpiresAt: now,
    tokenVersion: 1,
    createdAt: now,
    updatedAt: now,
    user: { id: linkedUser.id, name: linkedUser.name, email: linkedUser.email },
    ...overrides,
  };
}

export const braceletHandlers = [
  http.get(`${API}/events/:eventId/bracelets`, () => {
    return HttpResponse.json({
      bracelets: braceletStore.bracelets,
      nextCursor: null,
    });
  }),

  http.post(`${API}/events/:eventId/bracelets`, async ({ request, params }) => {
    const body = (await request.json()) as { userId: string; wristbandUid: string };
    const linkedUser = braceletStore.users.find((u) => u.id === body.userId);
    const bracelet = makeBracelet(
      {
        eventId: params.eventId as string,
        userId: body.userId,
        wristbandUid: body.wristbandUid,
      },
      linkedUser,
    );
    braceletStore.bracelets.push(bracelet);
    return HttpResponse.json(bracelet, { status: 201 });
  }),

  http.patch(`${API}/events/:eventId/bracelets/:id/revoke`, async ({ request, params }) => {
    const body = (await request.json()) as { reason?: string };
    const idx = braceletStore.bracelets.findIndex((b) => b.id === params.id);
    if (idx < 0) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const updated: BraceletAssignment = {
      ...braceletStore.bracelets[idx],
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokeReason: body.reason ?? null,
    };
    braceletStore.bracelets[idx] = updated;
    return HttpResponse.json(updated);
  }),

  http.post(`${API}/events/:eventId/bracelets/:id/replace`, async ({ request, params }) => {
    const body = (await request.json()) as { wristbandUid: string; reason?: string };
    const idx = braceletStore.bracelets.findIndex((b) => b.id === params.id);
    if (idx < 0) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const previous = braceletStore.bracelets[idx];
    const replacedPrevious: BraceletAssignment = {
      ...previous,
      status: 'replaced',
      revokedAt: new Date().toISOString(),
      revokeReason: body.reason ?? null,
    };
    const linkedUser = braceletStore.users.find((u) => u.id === previous.userId);
    const current = makeBracelet(
      {
        eventId: params.eventId as string,
        userId: previous.userId,
        wristbandUid: body.wristbandUid,
      },
      linkedUser,
    );
    braceletStore.bracelets[idx] = replacedPrevious;
    braceletStore.bracelets.push(current);
    return HttpResponse.json({ previous: replacedPrevious, current });
  }),

  http.get(`${API}/users`, ({ request }) => {
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const users = search
      ? braceletStore.users.filter(
          (u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search),
        )
      : braceletStore.users;
    return HttpResponse.json({ users, nextCursor: null });
  }),
];
