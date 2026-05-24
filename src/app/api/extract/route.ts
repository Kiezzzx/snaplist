import sharp from 'sharp';
import type { ProductMetadata } from '@/lib/types';
import { createListing } from '@/lib/actions/listings';
import { extractProductMetadata } from '@/lib/ai/extract-metadata';
import { getAnonSessionId } from '@/lib/session';
import { checkRateLimit, getClientIdentifier } from '@/lib/ratelimit';
import type { ListingMetadata } from '@/lib/db/schema';

const MAX_PAYLOAD_BYTES = 4.5 * 1024 * 1024;

// TEMP: replace with R2 in Phase 4. A 100x100 webp at q=70 lands ~2–5 KB —
// small enough to ship inline on dashboard list rows without bloating the
// JSON payload, and lets the detail page render a real image before R2.
async function buildTinyThumbnail(rawBase64: string): Promise<string> {
  const buf = Buffer.from(rawBase64, 'base64');
  const out = await sharp(buf)
    .resize(100, 100, { fit: 'cover' })
    .webp({ quality: 70 })
    .toBuffer();
  return `data:image/webp;base64,${out.toString('base64')}`;
}

interface ExtractRequestBody {
  imageBase64: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ExtractRequestBody;
    const { imageBase64 } = body;

    if (!imageBase64) {
      return Response.json(
        { success: false, error: 'Missing imageBase64 in request body' },
        { status: 400 }
      );
    }

    // Strip the data URI prefix (e.g. "data:image/webp;base64,") before
    // byte-length and Sharp decode. Without this, the prefix bytes pollute
    // the size check and Sharp throws on the leading text.
    const rawBase64 = imageBase64.includes(',')
      ? imageBase64.slice(imageBase64.indexOf(',') + 1)
      : imageBase64;

    // Hard Constraint #6: payload check before any AI/storage call
    if (Buffer.byteLength(rawBase64, 'base64') > MAX_PAYLOAD_BYTES) {
      return Response.json(
        { success: false, error: 'Payload too large' },
        { status: 413 }
      );
    }

    // Rate limit AFTER the cheap local guards (so junk/oversized requests don't
    // burn a user's daily quota) but BEFORE Sharp + Gemini (so a throttled
    // request never spends Gemini quota). CLAUDE.md #5.
    // Auth hook: when Auth.js lands, resolve the session userId → tier 'auth'
    // (20/day) keyed on the user id. Until then every caller is anonymous.
    const anonSessionId = await getAnonSessionId();
    const identifier = getClientIdentifier(request, anonSessionId);
    const decision = await checkRateLimit(identifier, 'anon');
    if (!decision.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((decision.reset - Date.now()) / 1000));
      return Response.json(
        {
          success: false,
          code: 'RATE_LIMIT',
          error: `Daily limit reached (${decision.limit} free listings/day). Please try again later.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(decision.limit),
            'X-RateLimit-Remaining': String(decision.remaining),
            'X-RateLimit-Reset': String(decision.reset),
          },
        },
      );
    }

    // Run the AI extract and thumbnail build in parallel. Sharp is CPU-bound
    // and Gemini is network-bound, so wall-clock = max(both) instead of sum.
    // TEMP: replace thumbnail generation with R2 upload in Phase 4.
    const [object, thumbnailBase64] = await Promise.all([
      extractProductMetadata(imageBase64),
      buildTinyThumbnail(rawBase64),
    ]);

    const data: Partial<ProductMetadata> = { ...object, notes: '' };

    // AI returns suggestedPrice as a string ('180'); DB column is number.
    // Empty/non-numeric → omit so the JSONB stays clean rather than storing NaN.
    const priceNum = Number(object.suggestedPrice);
    const dbMetadata: ListingMetadata = {
      category: object.category,
      brand: object.brand,
      model: object.model,
      condition: object.condition,
      ...(Number.isFinite(priceNum) && priceNum > 0 ? { suggestedPrice: priceNum } : {}),
    };

    const dbId = await createListing(dbMetadata, { thumbnailBase64 });

    return Response.json({ success: true, dbId, metadata: data });
  } catch (error) {
    console.error('Extract API error:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      // Distinct from our own RATE_LIMIT above — this is Gemini's transient
      // quota error, not the user hitting their daily allowance.
      return Response.json(
        { success: false, code: 'AI_BUSY', error: 'AI service is busy. Please wait a moment and try again.' },
        { status: 429 }
      );
    }
    return Response.json(
      { success: false, error: msg || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
