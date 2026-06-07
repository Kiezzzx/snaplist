import { test, expect } from '@playwright/test';
import { uploadFixture, waitForExtraction } from './helpers';

// Card links point at /dashboard/<id>; header nav links point at "/", so this
// selector matches listing cards only.
const cardLink = 'a[href^="/dashboard/"]';

// TC-25 — the dashboard lists the current session's listings.
test('dashboard shows listings for current session', async ({ page }) => {
  await page.goto('/');
  await uploadFixture(page);
  await waitForExtraction(page); // also guarantees the draft row exists

  await page.goto('/dashboard');

  await expect(page.locator(cardLink).first()).toBeVisible({ timeout: 10_000 });
});

// TC-27 / TC-29 — deleting a card keeps the user on /dashboard and removes it.
test('delete stays on dashboard and removes the card', async ({ page }) => {
  await page.goto('/');
  await uploadFixture(page);
  await waitForExtraction(page);

  await page.goto('/dashboard');
  const cards = page.locator(cardLink);
  await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  const before = await cards.count();

  // delete-button.tsx guards the action behind window.confirm — accept it.
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete listing' }).first().click();

  // Stayed on the dashboard (preventDefault/stopPropagation kept the row <Link>
  // from navigating to the detail page)...
  await expect(page).toHaveURL(/\/dashboard$/);
  // ...and the card was removed after the server action revalidated the list.
  await expect.poll(() => cards.count(), { timeout: 10_000 }).toBeLessThan(before);
});
