import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { ProductMetadata } from '@/lib/types';

const MAX_PAYLOAD_BYTES = 4.5 * 1024 * 1024;

const productMetadataSchema = z.object({
  category: z.string(),
  brand: z.string(),
  model: z.string(),
  condition: z.string(),
  suggestedPrice: z.string(),
  notes: z.string(),
});

const systemPrompt = `You are an expert second-hand goods appraiser.
Analyze the image and extract product details.
For suggestedPrice, estimate a fair second-hand
market price in AUD based on condition.
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

    // Strip data URL prefix before sending to OpenAI
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: productMetadataSchema,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: base64Data,
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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
