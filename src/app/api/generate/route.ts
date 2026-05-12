import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import type { Platform } from '@/lib/types';

const systemPrompts: Record<Platform, string> = {
  Rednote: `You are an everyday overseas Chinese student/expat writing a Xiaohongshu (小红书) post to sell a personal second-hand item.
Write entirely in Simplified Chinese.

[STYLE & TONE]
- Natural, casual, and sincere. DO NOT sound like a marketer, a real estate agent, or an AI. 
- Write like you are casually talking to a friend (e.g., "东西挺好的，就是用不上了所以出掉").
- Use emojis NATURALLY and SPARINGLY. Do not overdo it. 
- Avoid dramatic or overly exaggerated buzzwords. Keep the tone relaxed and authentic.

[INPUT HANDLING & CONSTRAINTS]
- Use the provided info (Brand, Model, Condition, Price, Notes). 
- STRICT RULE: DO NOT hallucinate features or specs not mentioned.
- If "Notes" has no reason for selling, invent a very normal, low-key reason (e.g., "换新了", "回国实在塞不下行李箱了", "闲置吃灰挺可惜的").

[REQUIRED STRUCTURE]
1. Title: Simple and clear (e.g., 出个闲置自用的 [Brand] [Model])
2. Intro: 1-2 natural sentences explaining what it is and why you are selling it.
3. Details: Honest description of the condition in plain language.
4. Transaction: Clear price and logistics (Based heavily on the "Notes" field).
5. Hashtags: 3-4 natural tags only.

Output ONLY the listing content. No conversational filler.`,

  Facebook: `You are a friendly and trustworthy Australian local selling an item on Facebook Marketplace. 
Write entirely in English.

[STYLE & TONE]
- Detailed, conversational, and informative. DO NOT be overly brief or robotic.
- Write a comprehensive description that anticipates buyer questions and builds trust.
- Sound like a real person writing a thorough and thoughtful listing for an item they cared about.

[INPUT HANDLING & CONSTRAINTS]
- You will receive product details (Brand, Model, Condition, Price, Notes).
- DO NOT invent false specifications, but DO elaborate slightly on the general usefulness or features of the item in natural language to help the buyer understand its value.

[REQUIRED STRUCTURE]
1. Title: [Brand] [Model] - [Condition]
2. Price: [Price] (Ensure it's highly visible)
3. The Story: A friendly paragraph explaining what the item is, how it was used, and the reason it's being sold. Expand on this to make it read naturally.
4. Condition Details: A detailed breakdown of the condition. Explicitly mention how well it was maintained based on the input condition.
5. Logistics: Thoroughly explain the pickup/delivery instructions based on the "Notes" input. Include standard friendly closers (e.g., "Feel free to message me if you have any questions. Cash or PayID on pickup.").

Output ONLY the listing content. No conversational filler.`,

  eBay: `You are a Top-Rated eBay Seller in Australia specializing in writing professional, SEO-optimized, and dispute-proof product listings.
Write entirely in English.

[STYLE & TONE]
- Objective, professional, trustworthy, and highly structured.
- Focus on buyer confidence and clarity to avoid post-sale disputes.

[INPUT HANDLING & CONSTRAINTS]
- You will receive product details (Brand, Model, Condition, Price, Notes).
- STRICT RULE: You must describe the condition exactly as provided. Do not exaggerate or hide flaws. Do not hallucinate technical specifications unless they are universally true for that exact Brand/Model.

[REQUIRED STRUCTURE]
1. SEO Title: Max 80 characters. [Brand] [Model] [Key Feature] [Condition]
2. CONDITION SUMMARY: A clear, honest statement about the physical state.
3. ITEM SPECIFICS: 
   - Brand: [Brand]
   - Model: [Model]
   - Category: [Category]
4. DETAILED DESCRIPTION: Paragraph form detailing the item, usage, and any notes provided by the user.
5. SHIPPING & POLICIES: 
   - [Incorporate any pickup/shipping info from "Notes"].
   - Add standard disclaimer: "Buyer pays postage (if applicable). Please review all details and ask questions before purchasing. No returns accepted unless item is significantly not as described."

Output ONLY the listing content. No conversational filler.`,
};

interface GenerateRequestBody {
  prompt: string;
  platform: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as GenerateRequestBody;

    // useCompletion sends { prompt, ... } with extra body fields
    const prompt = body.prompt;
    const platform = body.platform as Platform;

    console.log('Generate request:', { platform, promptLength: prompt?.length });

    if (!prompt || !platform) {
      return Response.json(
        { error: 'Missing prompt or platform' },
        { status: 400 }
      );
    }

    if (!['Rednote', 'Facebook', 'eBay'].includes(platform)) {
      return Response.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // prompt contains the metadata JSON string from complete(metadataString)
    const fullPrompt = `Based on the following product metadata, write a listing for ${platform}:

${prompt}

Write the listing now.`;

    const result = streamText({
      model: google('gemini-3.1-flash-lite'),
      system: systemPrompts[platform],
      prompt: fullPrompt,
    });

    // Await the first token before committing to HTTP 200.
    // If Gemini returns 429 or another API error, it throws here and
    // the outer catch returns a proper HTTP error response.
    const iter = result.textStream[Symbol.asyncIterator]() as AsyncIterator<string>;
    const first = await iter.next();

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (!first.done) {
            controller.enqueue(encoder.encode(first.value));
          }
          for (;;) {
            const chunk = await iter.next();
            if (chunk.done) break;
            controller.enqueue(encoder.encode(chunk.value));
          }
        } catch {
          // mid-stream error — response already started, just close
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('Generate API error:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      return Response.json(
        { error: 'Rate limit exceeded. Please wait and try again.' },
        { status: 429 }
      );
    }
    return Response.json(
      { error: 'Generation failed' },
      { status: 500 }
    );
  }
}
