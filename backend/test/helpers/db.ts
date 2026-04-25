import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '../../src/common/database/schemas';

export type TestDb = {
  container: StartedPostgreSqlContainer;
  url: string;
  client: ReturnType<typeof postgres>;
  drizzle: ReturnType<typeof drizzle>;
};

// Spins up a real Postgres container, applies the Drizzle schema via
// pushSchema (the same machinery `drizzle-kit push` uses), and returns
// handles for the test code to use. Mirrors how `nodejs-testing-best-practices`
// recommends real infra over mocks.
export const startTestDatabase = async (): Promise<TestDb> => {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('bracelets_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const url = container.getConnectionUri();
  const client = postgres(url, { prepare: false, max: 5 });
  const db = drizzle({ client, schema });

  const { apply } = await pushSchema(
    schema as unknown as Record<string, unknown>,
    db as never,
  );
  await apply();

  return { container, url, client, drizzle: db };
};

export const stopTestDatabase = async (db: TestDb | null): Promise<void> => {
  if (!db) return;
  try {
    await db.client.end({ timeout: 5 });
  } catch {
    // ignore: container is shutting down anyway
  }
  await db.container.stop();
};

// Truncate all tables touched by the bracelets module between test cases.
// Order matches FK dependencies. We use TRUNCATE ... CASCADE so we do not
// have to think about this manually as the schema grows.
export const truncateAll = async (db: TestDb): Promise<void> => {
  await db.drizzle.execute(sql`
    TRUNCATE TABLE
      audit_logs,
      event_bracelets,
      vendor_members,
      vendors,
      event_members,
      events,
      "session",
      "account",
      "user"
    RESTART IDENTITY CASCADE;
  `);
};
