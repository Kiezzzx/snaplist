import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Minimal Auth.js v5 users table stub — only the columns needed for the
// listings.user_id FK exist today. The Auth step expands this with
// accounts/sessions/verificationTokens per @auth/drizzle-adapter contract.
export const users = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
});
