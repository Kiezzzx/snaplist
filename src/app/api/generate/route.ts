import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import type { Platform, ProductMetadata } from '@/lib/types';

const VALID_PLATFORMS: Platform[] = ['Rednote', 'Facebook', 'eBay'];

const systemPrompts: Record<Platform, string> = {
  Rednote: `You are a Chinese social media expert writing
second-hand listing posts for Rednote (小红书).
Write in Simplified Chinese. Use a warm,
enthusiastic tone with relevant emojis.

Example output format:
🎧 出二手｜索尼降噪耳机 近全新

✨ 入手没多久换成入耳式了 闲置出掉～

【物品状态】
→ 外观近全新，无明显划痕
→ 功能完全正常
→ 原装配件齐全

【为什么值得买】
索尼旗舰降噪，市价AUD$350+
现在捡漏价💸

📍墨尔本CBD自取优先
💬 价格可小刀

#二手好物 #索尼耳机 #墨尔本二手 #断舍离`,

  Facebook: `You are writing a Facebook Marketplace listing
for the Australian second-hand market.
Write in English. Be direct and factual.

Example output format:
Sony WH-1000XM5 Headphones – Like New – AUD $180

Condition: Like new, used less than 10 times
Includes: Original box, case, USB-C cable, adapter

Selling because I switched to IEMs.
No scratches, works perfectly.

Pick up only – Melbourne CBD
Cash or bank transfer preferred
Open to reasonable offers`,

  eBay: `You are writing a professional eBay listing
for the Australian marketplace.
Write in English. Be detailed and objective.
Include condition specifics, what is included,
and a brief return/buyer policy statement.

Example output format:
Sony WH-1000XM5 Wireless Noise-Cancelling
Headphones | Like New | Full Accessories

CONDITION: Like new – used fewer than 10 times
No scratches, dents, or faults.

INCLUDES:
- Original retail box
- Premium carry case
- USB-C charging cable
- 3.5mm audio cable

SPECIFICATIONS:
- Battery: Up to 30 hours
- Connectivity: Bluetooth 5.2

Buyer pays postage. Returns accepted within
14 days if item not as described.`,
};

interface GenerateRequestBody {
  metadata: ProductMetadata;
  platform: string;
}

function isValidPlatform(platform: string): platform is Platform {
  return VALID_PLATFORMS.includes(platform as Platform);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const { metadata, platform } = body;

    if (!metadata) {
      return Response.json(
        { error: 'Missing metadata in request body' },
        { status: 400 }
      );
    }

    if (!platform || !isValidPlatform(platform)) {
      return Response.json({ error: 'Invalid platform' }, { status: 400 });
    }

    const systemPrompt = systemPrompts[platform];

    const result = streamText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      prompt: `Based on the following product metadata, write a listing for ${platform}:

${JSON.stringify(metadata, null, 2)}

Write the listing now.`,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
