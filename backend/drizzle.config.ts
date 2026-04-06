import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });
config({ path: '.env', override: false });

export default defineConfig({
  dialect: 'postgresql',
  out: './src/common/database/migrations',
  schema: './src/common/database/schemas/*',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
