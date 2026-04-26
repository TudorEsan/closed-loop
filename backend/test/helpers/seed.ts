import { faker } from '@faker-js/faker';
import { eventMembers, events, users } from '../../src/common/database/schemas';
import type { TestDb } from './db';

export type SeededUser = {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'user';
  isActive: boolean;
};

export const seedUser = async (
  db: TestDb,
  overrides: Partial<SeededUser> = {},
): Promise<SeededUser> => {
  const row = {
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    role: 'user' as SeededUser['role'],
    isActive: true,
    ...overrides,
  };

  await db.drizzle.insert(users).values({
    id: row.id,
    email: row.email,
    emailVerified: true,
    name: row.name,
    role: row.role,
    isActive: row.isActive,
  });

  return row;
};

export const seedEvent = async (
  db: TestDb,
  organizerId: string,
  overrides: Partial<{
    name: string;
    status: 'draft' | 'setup' | 'active' | 'settlement' | 'closed';
  }> = {},
): Promise<{ id: string; organizerId: string; status: string }> => {
  const id = faker.string.uuid();
  const slug = faker.helpers
    .slugify(`${faker.lorem.words(2)}-${faker.string.alphanumeric(6)}`)
    .toLowerCase();
  const start = faker.date.future();
  const end = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 3);

  await db.drizzle.insert(events).values({
    id,
    name: overrides.name ?? faker.company.name(),
    slug,
    organizerId,
    status: overrides.status ?? 'active',
    tokenCurrencyRate: '1.0000',
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  });

  return { id, organizerId, status: overrides.status ?? 'active' };
};

export const seedEventMember = async (
  db: TestDb,
  eventId: string,
  userId: string,
  role: 'admin' | 'operator' = 'admin',
): Promise<void> => {
  await db.drizzle.insert(eventMembers).values({
    eventId,
    userId,
    role,
  });
};

// Generate a fake but well-formed wristband UID. Uppercase hex pairs
// separated by colons, mirroring how the chip prints them in the field.
export const fakeWristbandUid = (): string =>
  Array.from({ length: 7 }, () =>
    faker.string.hexadecimal({ length: 2, prefix: '', casing: 'upper' }),
  ).join(':');
