import Anthropic from '@anthropic-ai/sdk';
import { initRefract } from '@refract/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Refract SDK
const Refract = initRefract({
  api_key: process.env.REFRACT_API_KEY || 'Refract_test123_abc',
  endpoint: process.env.REFRACT_ENDPOINT || 'http://localhost:8080/v1/traces',
  service_name: 'nextjs-rag-example',
  environment: 'live',
});

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message: string };
    const { message } = body;

    // Wrap the Anthropic call with Refract.traceLLM()
    const response = await Refract.traceLLM(
      async () => {
        return await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          messages: [{ role: 'user', content: message }],
        });
      },
      {
        name: '/api/chat',
        system: 'anthropic',
        prompt: message,
        tags: ['nextjs', 'rag', 'test', 'anthropic'],
        metadata: {
          endpoint: '/api/chat',
          userMessage: message,
        },
      }
    );

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : 'No response';

    return Response.json({
      message: reply,
      usage: response.usage,
      model: response.model,
    });
  } catch (error) {
    console.error('[Next.js] Error:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
