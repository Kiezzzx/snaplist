import type { ProductMetadata } from '@/lib/types';
import type { ListingMetadata } from '@/lib/db/validators';

// Coerce a possibly-blank / non-numeric string price to a positive number, or
// undefined. Blank or NaN or <= 0 all collapse to undefined so the caller can
// omit the field rather than persist a meaningless 0 / NaN into the JSONB.
function toPositiveNumber(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Single source of the form-shape → DB-shape metadata mapping.
 *
 * Both write paths funnel through here — /api/extract (creating the row from the
 * AI's prefill) and updateListingMetadata (persisting the user's reviewed edits)
 * — so the price-fallback and empty→undefined cleaning rules can't drift between
 * the two. Previously each path hand-rolled this conversion, and a fix to one
 * (e.g. the price fallback) had to be remembered in the other.
 *
 * Price: the DB stores ONE numeric price in `suggestedPrice`. The user's asking
 * price (`form.price`) wins; the AI estimate (`form.suggestedPrice`) is the
 * fallback only when the user left the asking price blank. Blank/non-numeric on
 * both → the field is omitted so the JSONB stays clean.
 *
 * Empty text fields → undefined so the dashboard's `?? '—'` fallbacks render
 * a dash instead of a blank cell.
 */
export function toListingMetadata(form: ProductMetadata): ListingMetadata {
  const price = toPositiveNumber(form.price) ?? toPositiveNumber(form.suggestedPrice);

  return {
    category: form.category || undefined,
    brand: form.brand || undefined,
    model: form.model || undefined,
    condition: form.condition || undefined,
    notes: form.notes || undefined,
    ...(price !== undefined ? { suggestedPrice: price } : {}),
  };
}
