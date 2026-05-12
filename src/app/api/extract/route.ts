
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { ProductMetadata } from '@/lib/types';

const MAX_PAYLOAD_BYTES = 4.5 * 1024 * 1024;

const productMetadataSchema = z.object({
  category: z.string(),
  brand: z.string(),
  model: z.string(),
  condition: z.string(),
  suggestedPrice: z.string().transform((val) => {
    // Strip any non-numeric characters except decimal
    const cleaned = val.replace(/[^0-9.]/g, '');
    return cleaned || '';
  }),
  notes: z.string(),
});

const systemPrompt = `You are an expert second-hand goods appraiser.
Analyze the image and extract product details.

For suggestedPrice: Research typical second-hand market value in Australia (AUD).
Return ONLY a number like '150' or '299'.
No currency symbols, no ranges like '100-200', just a single number.
If truly unknown, return empty string.

Return empty string for any field you are unsure about.
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

    const data: Partial<ProductMetadata> = object;

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
