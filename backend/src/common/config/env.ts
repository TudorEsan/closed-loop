import { config } from 'dotenv';

// Load .env.local first, then .env as fallback.
// Import this file at the very top of main.ts (before anything else)
// so that process.env is populated before any module reads it.
config({ path: '.env.local' });
config({ path: '.env', override: false });
