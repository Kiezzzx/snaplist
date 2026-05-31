// src/lib/types.ts

import type { Platform } from './platforms';

/**
 * Core product metadata.
 * Contains data extracted by AI and manually adjusted by the user.
 */
export interface ProductMetadata {
  category: string;
  brand: string;
  model: string;
  condition: string;
  price: string;
  suggestedPrice?: string;
  notes?: string;
}

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
