import { defineConfig } from 'drizzle-kit';
import { loadEnvConfig } from '@next/env';

// drizzle-kit runs as a standalone Node process outside the Next.js runtime,
// so .env.local isn't auto-loaded. @next/env replays Next's env file priority.
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL missing — check .env.local');
}

export default defineConfig({
  schema: ['./src/lib/db/schema.ts', './src/lib/db/auth-schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
