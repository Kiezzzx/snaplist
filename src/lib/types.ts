// src/lib/types.ts

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
 */
export type Platform = 'Rednote' | 'Facebook' | 'eBay';

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
  data?: Partial<ProductMetadata>;
  error?: string;
}
