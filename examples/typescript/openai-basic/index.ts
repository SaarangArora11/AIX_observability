#!/usr/bin/env bun
/**
 * Refract + OpenAI Basic Integration Example
 *
 * This example shows how to integrate Refract observability with OpenAI SDK.
 *
 * Setup:
 *   1. Start Refract: cd ../../infra/docker && docker-compose up -d
 *   2. Set your OpenAI API key: export OPENAI_API_KEY=sk-...
 *   3. Run this example: bun run index.ts
 */

import OpenAI from 'openai';
import { Refract } from '@refract/sdk';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Refract (no API key needed for self-hosted!)
const Refract = new Refract({
  endpoint: process.env.REFRACT_ENDPOINT || 'http://localhost:8080/v1/traces',
  service_name: 'openai-basic-example',
  environment: 'live',
});

async function chatWithOpenAI(prompt: string) {
  console.log('\n Sending prompt:', prompt);

  try {
    // Wrap your OpenAI call with Refract.traceLLM()
    const response = await Refract.traceLLM(
      async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 150,
        });
      },
      {
        name: 'chat-completion',
        provider: 'openai',
        model: 'gpt-4',
        prompt: prompt,
        tags: ['chat', 'example'],
        metadata: {
          temperature: 0.7,
          max_tokens: 150,
        },
      }
    );

    const message = response.choices[0]?.message?.content || 'No response';
    console.log('📥 Response:', message);
    console.log('💰 Cost:', `$${((response.usage?.total_tokens || 0) * 0.00003).toFixed(6)}`);
    console.log('📊 Tokens:', response.usage?.total_tokens);
    console.log('✅ Trace sent to Refract!');

    return message;
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Refract + OpenAI Integration Example');
  console.log('='.repeat(50));

  // Example 1: Simple chat
  await chatWithOpenAI('What is the capital of France?');

  // Example 2: More complex prompt
  await chatWithOpenAI('Explain quantum computing in one sentence.');

  // Flush traces before exiting
  console.log('\n⏳ Flushing traces...');
  await Refract.flush();
  console.log('✅ All traces flushed!');

  console.log('\n✨ Done! Check your traces at http://localhost:3000/traces');
}

main().catch(console.error);
