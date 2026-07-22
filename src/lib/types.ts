// src/lib/types.ts

import { z } from 'zod';
import type { Platform } from './platforms';

/**
 * Core product metadata — the form/client shape.
 * Contains data extracted by AI and manually adjusted by the user.
 *
 * Defined as a Zod schema (single source of truth) with the TS type derived via
 * z.infer, mirroring the DB-side pattern in lib/db/validators.ts. This keeps the
 * runtime boundary parse (server actions re-parse form input with this schema)
 * and the compile-time type from ever drifting apart. `price` is the user's
 * asking price; `suggestedPrice` is the AI's estimate — both carried as strings
 * because they originate in text inputs. lib/metadata.ts maps this to the DB's
 * single numeric price.
 */
export const productMetadataSchema = z.object({
  category: z.string(),
  brand: z.string(),
  model: z.string(),
  condition: z.string(),
  price: z.string(),
  suggestedPrice: z.string().optional(),
  notes: z.string().optional(),
});

export type ProductMetadata = z.infer<typeof productMetadataSchema>;

/**
 * Dirty state tracker to prevent overwrite.
 * Tracks if a user has manually modified a specific field.
 * true means modified; AI Extract response must not overwrite this field.
 */
export type DirtyState = {
  [K in keyof ProductMetadata]: boolean;
};

/**
 * Lifecycle status for content generation.
 */
export type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Supported publishing platforms.
 * Defined in lib/platforms.ts (the single source for platform config);
 * re-exported here so existing `from '@/lib/types'` imports keep working.
 */
export type { Platform };

/**
 * Listing state for a single platform.
 * Strictly bound inside the ListingEditor component to achieve render isolation.
 */
export interface PlatformListing {
  platform: Platform;
  content: string;
  status: GenerationStatus;
  errorMessage?: string;
}

/**
 * Response contract for the Extract API (Stage 1).
 */
export interface ExtractResponse {
  success: boolean;
  dbId?: string;
  metadata?: Partial<ProductMetadata>;
  error?: string;
}
