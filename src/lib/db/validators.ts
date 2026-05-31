import { z } from 'zod';

// Single source of truth for the JSONB column shapes. CLAUDE.md constraint #3
// requires a runtime Zod re-parse at every read boundary (Drizzle's $type<> is
// compile-time only). Defining the schema once here — and deriving the TS types
// from it via z.infer — keeps the runtime guard and the compile-time type from
// ever drifting apart. schema.ts, the listing actions, and both dashboard read
// pages all import from this module.

export const listingMetadataSchema = z.object({
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.string().optional(),
  category: z.string().optional(),
  suggestedPrice: z.number().optional(),
  notes: z.string().optional(),
});

export type ListingMetadata = z.infer<typeof listingMetadataSchema>;

const platformCopySchema = z.object({ content: z.string() }).optional();

export const generatedCopiesSchema = z.object({
  Rednote: platformCopySchema,
  Facebook: platformCopySchema,
  eBay: platformCopySchema,
});

export type GeneratedCopies = z.infer<typeof generatedCopiesSchema>;
