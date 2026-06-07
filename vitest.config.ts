import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // Unit tests live in tests/ alongside the Playwright e2e specs. Match only
    // *.test.ts so Vitest never tries to run the Playwright *.spec.ts files.
    include: ['tests/**/*.test.ts'],
  },
});
