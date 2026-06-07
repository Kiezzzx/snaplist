import { test, expect } from '@playwright/test';

// TC-26 — a listing ID the session doesn't own (here, a non-existent one) is
// indistinguishable from "not found": the detail page calls notFound() rather
// than leaking existence. The App Router streams the page shell first (so the
// document status is 200) and then resolves notFound(), swapping in Next's
// default not-found UI — assert on that UI, not the HTTP status.
test('foreign / non-existent listing ID returns 404', async ({ page }) => {
  await page.goto('/dashboard/00000000-0000-0000-0000-000000000000');

  await expect(
    page.getByText(/this page could not be found/i),
  ).toBeVisible({ timeout: 15_000 });
});
