import { type Page, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.join(__dirname, 'fixtures', 'test-item.jpg');

/** Upload the product-photo fixture via the (hidden) file input on the home page. */
export async function uploadFixture(page: Page): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
}

/**
 * Resolve once AI extraction has populated the form. Category + condition are
 * required enums in the extraction schema, so the AI always fills them — their
 * appearance is the reliable "extraction done" signal. (The form is always
 * rendered, so the Generate button is not a usable completion signal.)
 *
 * Reaching this state also guarantees the draft `listings` row has been created,
 * since /api/extract inserts the row before returning the metadata.
 */
export async function waitForExtraction(page: Page): Promise<void> {
  await expect(page.locator('#condition')).not.toHaveValue('', { timeout: 30_000 });
}
