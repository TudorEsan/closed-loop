import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schemas';

export function createDrizzleClient(databaseUrl: string, logger?: boolean) {
  const client = postgres(databaseUrl, {
    prepare: false,
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
  });
  return drizzle({ client, logger, schema });
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;
