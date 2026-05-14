
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { ProductMetadata } from '@/lib/types';

const MAX_PAYLOAD_BYTES = 4.5 * 1024 * 1024;

const productMetadataSchema = z.object({
  category: z.enum([
    'Electronics',
    'Furniture',
    'Clothing',
    'Books',
    'Sports',
    'Kitchen',
    'Toys',
    'Other',
  ]),
  brand: z.string(),
  model: z.string(),
  condition: z.enum(['Brand New', 'Like New', 'Good', 'Fair', 'Poor']),
  suggestedPrice: z.string().transform((val) => {
    // Strip any non-numeric characters except decimal
    const cleaned = val.replace(/[^0-9.]/g, '');
    return cleaned || '';
  }),
});

const systemPrompt = `Context: Australian second-hand market (AUD pricing).

You are an expert second-hand goods appraiser.
Analyze the image and extract product details.

Condition grading rubric:
- Brand New: sealed in original packaging, never used
- Like New: used once or twice, no visible marks
- Good: normal use, minor scratches only
- Fair: visible wear, scratches or small marks
- Poor: heavy wear, damage, or missing parts

For category: must be one of Electronics, Furniture, Clothing, Books, Sports, Kitchen, Toys, Other. If an item fits multiple categories, choose the most specific one. Example: Nike shoes → Clothing (not Sports). Use 'Other' only when no listed category fits.

For condition: must be one of Brand New, Like New, Good, Fair, Poor. Pick the best estimate based on the visible condition in the photo using the rubric above.

For model: return the specific SKU or model number if visible (e.g. 'WH-1000XM5', 'iPhone 14 Pro'). If only a generic description is possible, return that instead.

For suggestedPrice: Estimate the typical second-hand resale value in Australia (AUD) based on your knowledge of similar items. Only estimate if brand AND model are confidently identified. Format as a bare integer string only, e.g. '150'. If truly unknown, return empty string.

Example output:
{
  category: 'Electronics',
  brand: 'Sony',
  model: 'WH-1000XM5',
  condition: 'Good',
  suggestedPrice: '180'
}

Return empty string for brand, model, or suggestedPrice if you are unsure.
Never guess brand or model if not clearly visible.`;

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

    // Hard Constraint: Check payload size before AI call
    if (Buffer.byteLength(imageBase64, 'base64') > MAX_PAYLOAD_BYTES) {
      return Response.json(
        { success: false, error: 'Payload too large' },
        { status: 413 }
      );
    }

    const { object } = await generateObject({
      model: google('gemini-3.1-flash-lite'),
      system: systemPrompt,
      schema: productMetadataSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: imageBase64,
            },
            {
              type: 'text',
              text: 'Please analyze this image and extract the product details.',
            },
          ],
        },
      ],
    });

    const data: Partial<ProductMetadata> = { ...object, notes: '' };

    return Response.json({ success: true, data });
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
