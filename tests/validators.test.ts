import { describe, it, expect } from 'vitest';
import {
  listingMetadataSchema,
  generatedCopiesSchema,
} from '../src/lib/db/validators';

// TC-16 — runtime Zod parsing at the DB read boundary (CLAUDE.md constraint #3).
// Read sites use safeParse and fall back when a row's JSONB has drifted, so the
// key guarantee is "never throw, signal failure instead".

describe('listingMetadataSchema (TC-16)', () => {
  it('parses fully-valid metadata without error', () => {
    const result = listingMetadataSchema.safeParse({
      brand: 'Sony',
      model: 'WH-1000XM5',
      condition: 'Good',
      category: 'Electronics',
      suggestedPrice: 180,
      notes: 'pickup only',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brand).toBe('Sony');
      expect(result.data.suggestedPrice).toBe(180);
    }
  });

  it('does not throw on a string suggestedPrice — returns a safe (failed) result for fallback', () => {
    // suggestedPrice is z.number(); a string is the classic AI/historical drift.
    // safeParse must report failure rather than throw, so the caller can fall back.
    let result: ReturnType<typeof listingMetadataSchema.safeParse>;
    expect(() => {
      result = listingMetadataSchema.safeParse({ suggestedPrice: '180' });
    }).not.toThrow();

    expect(result!.success).toBe(false);
  });

  it('parses an object with missing fields, leaving them undefined', () => {
    const result = listingMetadataSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brand).toBeUndefined();
      expect(result.data.model).toBeUndefined();
      expect(result.data.suggestedPrice).toBeUndefined();
    }
  });
});

describe('generatedCopiesSchema (TC-16)', () => {
  it('parses generated copies for all three platforms', () => {
    const result = generatedCopiesSchema.safeParse({
      Facebook: { content: 'fb copy' },
      eBay: { content: 'ebay copy' },
      Rednote: { content: 'rednote copy' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.Facebook?.content).toBe('fb copy');
      expect(result.data.eBay?.content).toBe('ebay copy');
      expect(result.data.Rednote?.content).toBe('rednote copy');
    }
  });

  it('parses with a missing platform key, leaving it undefined', () => {
    const result = generatedCopiesSchema.safeParse({
      Facebook: { content: 'fb copy' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.Facebook?.content).toBe('fb copy');
      expect(result.data.eBay).toBeUndefined();
      expect(result.data.Rednote).toBeUndefined();
    }
  });
});
