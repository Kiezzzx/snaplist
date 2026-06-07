import { test, expect } from '@playwright/test';
import { uploadFixture, waitForExtraction } from './helpers';

// TC-01 / TC-06 / TC-13 — happy-path upload → real Gemini extraction → form fill.
test('valid image → metadata extracted and form populated', async ({ page }) => {
  await page.goto('/');

  await uploadFixture(page);
  await waitForExtraction(page);

  const brand = (await page.locator('#brand').inputValue()).trim();
  const condition = (await page.locator('#condition').inputValue()).trim();
  const price = (await page.locator('#price').inputValue()).trim();

  expect(
    brand !== '' || condition !== '' || price !== '',
    `expected at least one of brand/condition/price to be populated ` +
      `(brand="${brand}", condition="${condition}", price="${price}")`,
  ).toBe(true);
});
