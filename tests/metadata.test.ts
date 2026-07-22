import { describe, it, expect } from 'vitest';
import { toListingMetadata } from '../src/lib/metadata';
import type { ProductMetadata } from '../src/lib/types';

// toListingMetadata is the single form-shape → DB-shape mapper shared by
// /api/extract (row creation from the AI prefill) and updateListingMetadata
// (persisting the user's reviewed edits). It used to be hand-rolled in both
// places; these cases lock in the price-fallback + empty-cleaning contract so
// the two paths can never drift again.

function form(overrides: Partial<ProductMetadata> = {}): ProductMetadata {
  return {
    category: 'Electronics',
    brand: 'Sony',
    model: 'WH-1000XM5',
    condition: 'Good',
    price: '',
    suggestedPrice: undefined,
    notes: undefined,
    ...overrides,
  };
}

describe('toListingMetadata — price resolution', () => {
  it("uses the user's asking price when present", () => {
    const out = toListingMetadata(form({ price: '150', suggestedPrice: '180' }));
    expect(out.suggestedPrice).toBe(150);
  });

  it('falls back to the AI estimate when asking price is blank', () => {
    const out = toListingMetadata(form({ price: '', suggestedPrice: '180' }));
    expect(out.suggestedPrice).toBe(180);
  });

  it('omits price entirely when both are blank', () => {
    const out = toListingMetadata(form({ price: '', suggestedPrice: '' }));
    expect(out).not.toHaveProperty('suggestedPrice');
  });

  it('omits price when the value is non-numeric or non-positive', () => {
    expect(toListingMetadata(form({ price: 'abc' }))).not.toHaveProperty('suggestedPrice');
    expect(toListingMetadata(form({ price: '0' }))).not.toHaveProperty('suggestedPrice');
    expect(toListingMetadata(form({ price: '-5' }))).not.toHaveProperty('suggestedPrice');
  });
});

describe('toListingMetadata — empty text cleaning', () => {
  it('maps empty strings to undefined so dashboard `?? "—"` fallbacks fire', () => {
    const out = toListingMetadata(form({ brand: '', model: '', notes: '' }));
    expect(out.brand).toBeUndefined();
    expect(out.model).toBeUndefined();
    expect(out.notes).toBeUndefined();
  });

  it('preserves non-empty text fields as-is', () => {
    const out = toListingMetadata(form({ brand: 'Sony', notes: 'boxed' }));
    expect(out.brand).toBe('Sony');
    expect(out.notes).toBe('boxed');
  });
});
