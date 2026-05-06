import OpenAI from 'openai';

const MODEL = process.env.VISION_MODEL ?? 'minimax-m2.7-vl';

let _client: OpenAI | undefined;
function client(): OpenAI {
  _client ??= new OpenAI({
    apiKey: process.env.OLLAMA_API_KEY ?? process.env.VISION_API_KEY ?? '',
    baseURL: process.env.OLLAMA_BASE_URL ?? 'https://ollama.com/v1',
  });
  return _client;
}

export function visionEnabled(): boolean {
  return Boolean(process.env.OLLAMA_API_KEY ?? process.env.VISION_API_KEY);
}

export async function visionYesNo(png: Buffer, question: string): Promise<boolean> {
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 8,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          {
            type: 'text',
            text: `${question}\n\nReply with exactly one word: YES or NO. No explanation.`,
          },
        ],
      },
    ],
  });
  const answer = (res.choices[0]?.message?.content ?? '').trim().toUpperCase();
  if (!/^(YES|NO)$/.test(answer)) {
    throw new Error(`vision model returned unparseable answer: "${answer}"`);
  }
  return answer === 'YES';
}

export async function visionAssert(png: Buffer, question: string): Promise<void> {
  if (!(await visionYesNo(png, question))) {
    throw new Error(`vision assertion failed: ${question}`);
  }
}
