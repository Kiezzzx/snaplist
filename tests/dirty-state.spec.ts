import { test, expect } from '@playwright/test';
import { uploadFixture, waitForExtraction } from './helpers';

// TC-14 — a field the user has typed into is never clobbered by a late AI merge.
test('manually edited price not overwritten by AI', async ({ page }) => {
  await page.goto('/');

  await uploadFixture(page);
  // Type into price immediately — before extraction resolves — marking it dirty.
  await page.locator('#price').fill('999');

  await waitForExtraction(page);

  await expect(page.locator('#price')).toHaveValue('999');
});
