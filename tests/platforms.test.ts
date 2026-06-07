import { describe, it, expect } from 'vitest';
import { PLATFORMS, PLATFORM_META, isPlatform } from '../src/lib/platforms';

// TC-38 — platform config is the single source of truth for order + metadata.

describe('PLATFORMS tuple (TC-38)', () => {
  it('has exactly three entries in order Facebook, eBay, Rednote', () => {
    expect(PLATFORMS).toHaveLength(3);
    expect([...PLATFORMS]).toEqual(['Facebook', 'eBay', 'Rednote']);
  });
});

describe('isPlatform (TC-38)', () => {
  it('returns true for a supported platform', () => {
    expect(isPlatform('Facebook')).toBe(true);
    expect(isPlatform('eBay')).toBe(true);
    expect(isPlatform('Rednote')).toBe(true);
  });

  it('returns false for an unsupported platform', () => {
    expect(isPlatform('Instagram')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isPlatform('')).toBe(false);
  });
});

describe('PLATFORM_META (TC-38)', () => {
  it('has keys that exactly match the PLATFORMS entries', () => {
    expect(Object.keys(PLATFORM_META).sort()).toEqual([...PLATFORMS].sort());
  });

  it('provides a number + label for every platform', () => {
    for (const platform of PLATFORMS) {
      expect(PLATFORM_META[platform]).toBeDefined();
      expect(typeof PLATFORM_META[platform].number).toBe('string');
      expect(PLATFORM_META[platform].label).toBe(platform);
    }
  });
});
