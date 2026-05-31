// Single source of truth for the supported publishing platforms. The order of
// PLATFORMS drives tab order, the all-done generation check, and dashboard
// indicators; PLATFORM_META drives the numbered labels shared across the home
// page, the live editor, and the read-only dashboard viewer. Adding a platform
// is a one-file change here instead of a hunt across components + routes.

export const PLATFORMS = ['Rednote', 'Facebook', 'eBay'] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_META: Record<Platform, { number: string; label: string }> = {
  Rednote: { number: '01', label: 'Rednote' },
  Facebook: { number: '02', label: 'Facebook' },
  eBay: { number: '03', label: 'eBay' },
};

// Stagger concurrent generate requests so 3 parallel calls don't hit Gemini in
// the same tick (the most common cause of one-platform-succeeds, others-429).
export const PLATFORM_STAGGER_MS: Record<Platform, number> = {
  Rednote: 0,
  Facebook: 250,
  eBay: 500,
};

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}
