import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for Snaplist critical user journeys.
 *
 * These tests make REAL Gemini calls (intentional). To keep the suite from
 * tripping Snaplist's OWN anonymous rate limit (3 uploads/day per IP via
 * Upstash), the dev server is started with the Upstash env vars blanked, which
 * puts rate limiting into fail-open mode. Gemini's own quota still applies.
 *
 * Serial execution (workers: 1, no retries) avoids Gemini RPM bursts and keeps
 * each real AI call deterministic. Each test is self-contained: any test needing
 * a pre-existing listing uploads one in its own body, and contexts are isolated
 * per test (each gets its own anonymous session cookie).
 */
export default defineConfig({
  testDir: './tests',
  // Vitest unit tests (*.test.ts) share this folder; only run the e2e specs.
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Blank Upstash creds => fail-open rate limiting for the test run, so the
    // suite's handful of real uploads aren't blocked by the 3/day anon cap.
    env: {
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '',
    },
  },
});
