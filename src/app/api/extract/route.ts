import type { ProductMetadata } from '@/lib/types';
import { createListing } from '@/lib/actions/listings';
import { extractProductMetadata } from '@/lib/ai/extract-metadata';
import type { ListingMetadata } from '@/lib/db/schema';

const MAX_PAYLOAD_BYTES = 4.5 * 1024 * 1024;

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

    // Hard Constraint #6: payload check before any AI/storage call
    if (Buffer.byteLength(imageBase64, 'base64') > MAX_PAYLOAD_BYTES) {
      return Response.json(
        { success: false, error: 'Payload too large' },
        { status: 413 }
      );
    }

    const object = await extractProductMetadata(imageBase64);

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

    const dbId = await createListing(dbMetadata);

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
