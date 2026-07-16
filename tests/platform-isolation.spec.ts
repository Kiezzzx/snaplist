import { test, expect, type Page } from '@playwright/test';
import { uploadFixture } from './helpers';

// ECL hard constraint #11 (Per-Platform Error Isolation): one platform's
// streaming failure must not affect the other two tabs. Each <ListingEditor>
// owns its own useCompletion stream (constraint #7), so a failure in one must
// leave the others' content intact — and a partial run must NOT flip the row to
// 'generated' (markListingAsGenerated fires only when EVERY platform succeeds,
// see use-listing-generation.ts).
//
// Patches window.fetch (like copy-clip.spec.ts) rather than page.route because
// the failure is MID-STREAM: Facebook streams one chunk then the body errors
// (controller.error). route.fulfill can only send a complete response, so it
// can't reproduce a stream that starts OK and then dies — the exact shape a
// real dropped/500'd SSE connection takes. eBay + Rednote stream to completion.
async function installFetchMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const realFetch = window.fetch.bind(window);

    function fakeCopy(platform: string): string {
      const lines = [`**Title:** ${platform} — Samsung Galaxy S21`, ''];
      for (let i = 1; i <= 12; i++) {
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
        const encoder = new TextEncoder();
        const failMidStream = platform === 'Facebook';
        const text = fakeCopy(platform);
        const chunks = text.match(/[\s\S]{1,40}/g) ?? [text];
        const stream = new ReadableStream({
          async start(controller) {
            // Facebook: emit one real chunk so the stream is genuinely in
            // flight, then kill the body. The consumer (useCompletion) is
            // mid-read when it dies — a true per-platform mid-stream failure.
            if (failMidStream) {
              controller.enqueue(encoder.encode(chunks[0]));
              await new Promise((r) => setTimeout(r, 25));
              controller.error(new Error('Simulated upstream 500 (Facebook)'));
              return;
            }
            for (const c of chunks) {
              controller.enqueue(encoder.encode(c));
              await new Promise((r) => setTimeout(r, 15));
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

test('one platform stream failing does not affect the other two', async ({ page }) => {
  // Capture server-action POSTs (Next.js posts them to the page path with a
  // `next-action` header). Two are relevant: updateListingMetadata — always
  // fired at generation start with the FULL metadata payload — and
  // markListingAsGenerated — the bare-id lifecycle write that must NOT fire on
  // a partial run. The metadata payload ('Samsung') tells the two apart.
  const serverActionBodies: string[] = [];
  page.on('request', (req) => {
    if (req.method() !== 'POST') return;
    if (!('next-action' in req.headers())) return;
    serverActionBodies.push(req.postData() ?? '');
  });

  await installFetchMock(page);
  await page.goto('/');
  await uploadFixture(page);

  await expect(page.locator('#condition')).toHaveValue('Good', { timeout: 15_000 });
  await page.getByRole('button', { name: 'GENERATE LISTINGS' }).click();

  // Output tabs carry BOTH the platform number and name (form toggles carry
  // just the name), matching copy-clip.spec.ts's disambiguation.
  const num: Record<string, string> = { Facebook: '01', eBay: '02', Rednote: '03' };
  const tab = (name: string) =>
    page.getByRole('button').filter({ hasText: num[name] }).filter({ hasText: name }).first();

  // --- Isolation: the two healthy streams complete, the failed one errors ---
  // These indicators live in the tab bar and update regardless of which tab is
  // active, so eBay/Rednote finishing here proves their streams ran unaffected
  // while Facebook died. Accessible names come from the status <span>/icon.
  await expect(
    page.getByRole('status', { name: 'eBay: generated' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('status', { name: 'Rednote: generated' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('status', { name: 'Facebook: generation failed' }),
  ).toBeVisible({ timeout: 15_000 });

  // --- Facebook tab shows an error state (it is the default active tab) ---
  await expect(page.getByText('Generation failed. Please try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

  // --- eBay tab shows completed content ---
  await tab('eBay').click();
  await expect(tab('eBay')).toHaveClass(/font-semibold/);
  await expect(page.locator('div.block textarea')).toBeVisible();
  await expect(page.locator('div.block textarea')).toHaveValue(/eBay description text/);
  await expect(page.locator('div.block').getByText(/Generation complete/)).toBeVisible();

  // --- Rednote tab shows completed content ---
  await tab('Rednote').click();
  await expect(tab('Rednote')).toHaveClass(/font-semibold/);
  await expect(page.locator('div.block textarea')).toBeVisible();
  await expect(page.locator('div.block textarea')).toHaveValue(/Rednote description text/);
  await expect(page.locator('div.block').getByText(/Generation complete/)).toBeVisible();

  // Give any (erroneous) late lifecycle write a chance to fire before asserting
  // its absence — the all-done branch runs synchronously as the last stream
  // settles, but this guards against a deferred call slipping through.
  await page.waitForTimeout(750);

  // --- Partial failure: markListingAsGenerated must NOT be called ---
  // Sanity that our capture works and generation actually started:
  // updateListingMetadata fired with the metadata payload.
  expect(serverActionBodies.some((b) => b.includes('Samsung'))).toBe(true);
  // The lifecycle write carries only the bare id — never the metadata payload.
  // Its presence would mean a partial run wrongly claimed completion.
  const markCalled = serverActionBodies.some(
    (b) => b.includes('test-db-id') && !b.includes('Samsung'),
  );
  expect(markCalled, 'markListingAsGenerated must not fire on a partial run').toBe(false);
});
