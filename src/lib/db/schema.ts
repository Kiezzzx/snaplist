import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth-schema';
import type { ListingMetadata, GeneratedCopies } from './validators';

type ImageStatus = 'pending' | 'uploaded' | 'processed' | 'failed';
type ListingStatus = 'draft' | 'generated' | 'sold';

// JSONB shapes live in ./validators as the single source (type + runtime Zod
// guard derived together). Re-exported here so existing `from '@/lib/db/schema'`
// imports keep working.
export type { ListingMetadata, GeneratedCopies };

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    anonymousSessionId: text('anonymous_session_id'),

    originalImageKey: text('original_image_key'),
    thumbnailKey: text('thumbnail_key'),
    // TEMP: replace with R2 in Phase 4. Stores a tiny 100x100 webp data URI so
    // the dashboard + detail page have something to render before R2 lands.
    thumbnailBase64: text('thumbnail_base64'),
    imageSize: integer('image_size'),

    // $type lifts the literal union to compile-time so a typo like 'uplaoded'
    // fails to compile instead of silently persisting an invalid state.
    imageStatus: text('image_status').$type<ImageStatus>().default('pending'),

    metadata: jsonb('metadata').$type<ListingMetadata>(),
    generatedCopies: jsonb('generated_copies').$type<GeneratedCopies>(),

    status: text('status').$type<ListingStatus>().default('draft'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('listings_user_created_idx').on(table.userId, table.createdAt.desc()),
    index('listings_user_status_idx').on(table.userId, table.status),
    index('listings_anon_session_idx').on(table.anonymousSessionId),
  ],
);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
