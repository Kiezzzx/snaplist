import 'server-only';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is missing — set it in .env.local');
}

function createDb() {
  return drizzle({ client: neon(DATABASE_URL!), schema });
}

const globalForDb = globalThis as unknown as {
  __db?: ReturnType<typeof createDb>;
};

// Reuse one Drizzle instance across Next.js HMR reloads in dev so we don't
// accumulate stale wrappers as files re-evaluate on save.
export const db = globalForDb.__db ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__db = db;
}
