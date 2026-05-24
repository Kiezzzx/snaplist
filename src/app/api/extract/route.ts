import sharp from 'sharp';
import type { ProductMetadata } from '@/lib/types';
import { createListing } from '@/lib/actions/listings';
import { extractProductMetadata } from '@/lib/ai/extract-metadata';
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
      return Response.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    return Response.json(
      { success: false, error: msg || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
