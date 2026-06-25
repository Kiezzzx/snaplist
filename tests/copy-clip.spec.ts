import { test, expect, type Page } from '@playwright/test';
import { uploadFixture } from './helpers';

// Regression: switching platform tabs used to leave the copy box clipped to its
// default ~2-row height. Root cause was a React state-bailout — re-measuring a
// tab whose height already equalled its state skipped the re-render, leaving the
// textarea stuck at the 'auto' height set imperatively while measuring.
//
// Patches window.fetch to STREAM /api/generate in delayed chunks (so the real
// <p>→textarea transition happens) and to answer /api/extract instantly. Real
// streaming matters: an atomic response would hide the timing the bug depends on.
async function installFetchMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const realFetch = window.fetch.bind(window);

    function fakeCopy(platform: string): string {
      const lines = [`**Title:** ${platform} — Samsung Galaxy S21`, ''];
      for (let i = 1; i <= 30; i++) {
        lines.push(`Line ${i}: ${platform} description text for the second-hand item listing.`);
      }
      return lines.join('\n');
    }

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (url.includes('/api/extract')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              dbId: 'test-db-id',
              metadata: {
                category: 'Electronics',
                brand: 'Samsung',
                model: 'Galaxy S21',
                condition: 'Good',
                price: '250',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/generate')) {
        let platform = 'Platform';
        try {
          platform = JSON.parse((init?.body as string) ?? '{}').platform ?? platform;
        } catch {}
        const text = fakeCopy(platform);
        const encoder = new TextEncoder();
        const chunks = text.match(/[\s\S]{1,40}/g) ?? [text];
        const stream = new ReadableStream({
          async start(controller) {
            for (const c of chunks) {
              controller.enqueue(encoder.encode(c));
              await new Promise((r) => setTimeout(r, 25));
            }
            controller.close();
          },
        });
        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          }),
        );
      }

      return realFetch(input as RequestInfo, init);
    }) as typeof window.fetch;
  });
}

/** scrollHeight - clientHeight for the visible platform's copy textarea. >2px ⇒ clipped. */
async function activeOverflow(page: Page): Promise<number> {
  const ta = page.locator('div.block textarea').first();
  await expect(ta).toBeVisible();
  return ta.evaluate((el) => el.scrollHeight - el.clientHeight);
}

test('copy box is not clipped when switching platform tabs', async ({ page }) => {
  await installFetchMock(page);
  await page.goto('/');
  await uploadFixture(page);

  await expect(page.locator('#condition')).toHaveValue('Good', { timeout: 15_000 });
  await page.getByRole('button', { name: 'GENERATE LISTINGS' }).click();

  // Output tabs are the only buttons carrying BOTH the platform number and name
  // (the left-column form toggles carry just the name).
  const num: Record<string, string> = { Facebook: '01', eBay: '02', Rednote: '03' };
  const tab = (name: string) =>
    page.getByRole('button').filter({ hasText: num[name] }).filter({ hasText: name }).first();

  // Let all three finish — eBay + Rednote stream while hidden, Facebook while active.
  await expect(tab('eBay').locator('svg')).toBeVisible({ timeout: 15_000 });
  await expect(tab('Rednote').locator('svg')).toBeVisible({ timeout: 15_000 });
  await expect(tab('Facebook').locator('svg')).toBeVisible({ timeout: 15_000 });

  // Facebook (active throughout generation) is the regression case: it gets
  // measured once while active, then must survive being switched away from and
  // back to. The trailing 'Facebook' exercises that switch-back path.
  for (const name of ['eBay', 'Rednote', 'Facebook', 'eBay', 'Facebook']) {
    await tab(name).click();
    await expect(tab(name)).toHaveClass(/font-semibold/); // wait for the switch to commit
    const overflow = await activeOverflow(page);
    expect(overflow, `tab "${name}" copy box clipped by ${overflow}px`).toBeLessThanOrEqual(2);
  }
});
