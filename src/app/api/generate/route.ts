import { after } from 'next/server';
import type { Platform } from '@/lib/types';
import { persistGeneratedCopy } from '@/lib/actions/listings';
import { streamListing } from '@/lib/ai/generate-listing';

interface GenerateRequestBody {
  prompt: string;
  platform: string;
  dbId?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as GenerateRequestBody;

    const prompt = body.prompt;
    const platform = body.platform as Platform;
    const dbId = body.dbId;

    console.log('Generate request:', { platform, dbId, promptLength: prompt?.length });

    if (!prompt || !platform || !dbId) {
      return Response.json(
        { error: 'Missing prompt, platform, or dbId' },
        { status: 400 }
      );
    }

    if (!['Rednote', 'Facebook', 'eBay'].includes(platform)) {
      return Response.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    const result = streamListing(platform, prompt);

    // Await the first token before committing to HTTP 200.
    // If Gemini returns 429 or another API error, it throws here and
    // the outer catch returns a proper HTTP error response.
    const iter = result.textStream[Symbol.asyncIterator]() as AsyncIterator<string>;
    const first = await iter.next();

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let streamedAny = false;
        let content = '';
        let succeeded = true;
        try {
          if (!first.done) {
            controller.enqueue(encoder.encode(first.value));
            content += first.value;
            streamedAny = true;
          }
          for (;;) {
            const chunk = await iter.next();
            if (chunk.done) break;
            controller.enqueue(encoder.encode(chunk.value));
            content += chunk.value;
            streamedAny = true;
          }
        } catch (err) {
          // Mid-stream failure: HTTP 200 is already committed, so we can't switch
          // to an error status code. Surface the failure to the client as a visible
          // sentinel rather than silently truncating — otherwise the UI would render
          // partial output and label it "Generation complete".
          console.error('Generate stream mid-stream error:', err);
          succeeded = false;
          const marker = streamedAny
            ? '\n\n[ERROR: stream interrupted — please regenerate]'
            : '[ERROR: generation failed — please regenerate]';
          try {
            controller.enqueue(encoder.encode(marker));
          } catch {
            // controller already closed; nothing we can do
          }
        } finally {
          controller.close();
          // Persist after the client gets the full stream — `after` extends the
          // serverless function's lifetime past response completion. Skip on
          // failure so partial/errored output never gets saved as "the listing copy".
          if (succeeded && content.length > 0) {
            after(async () => {
              try {
                await persistGeneratedCopy(dbId, platform, content);
              } catch (dbErr) {
                console.error(`Failed to persist ${platform} copy for ${dbId}:`, dbErr);
              }
            });
          }
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
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('overloaded')) {
      return Response.json(
        { error: 'Model temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }
    return Response.json(
      { error: 'Generation failed' },
      { status: 500 }
    );
  }
}
