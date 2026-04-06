import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
// import * as schema from './schemas';

export function createDrizzleClient(databaseUrl: string, logger?: boolean) {
  const client = postgres(databaseUrl, {
    prepare: false,
  });
  return drizzle({ client, logger });
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;
