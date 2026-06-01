// Single source of truth for the supported publishing platforms. The order of
// PLATFORMS drives tab order, the all-done generation check, and dashboard
// indicators; PLATFORM_META drives the numbered labels shared across the home
// page, the live editor, and the read-only dashboard viewer. Adding a platform
// is a one-file change here instead of a hunt across components + routes.

export const PLATFORMS = ['Facebook', 'eBay', 'Rednote'] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_META: Record<Platform, { number: string; label: string }> = {
  Facebook: { number: '01', label: 'Facebook' },
  eBay: { number: '02', label: 'eBay' },
  Rednote: { number: '03', label: 'Rednote' },
};

// Stagger concurrent generate requests so 3 parallel calls don't hit Gemini in
// the same tick (the most common cause of one-platform-succeeds, others-429).
// Offsets follow PLATFORMS order: the first platform fires immediately, the
// rest trail it — cosmetic only, all three still launch near-simultaneously.
export const PLATFORM_STAGGER_MS: Record<Platform, number> = {
  Facebook: 0,
  eBay: 250,
  Rednote: 500,
};

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}
