/**
 * OpenAI-Compatible Proxy Route
 *
 * Handles requests in OpenAI's /v1/chat/completions format.
 * Supports any OpenAI-compatible provider (OpenAI, local models, etc).
 */

import { Hono } from 'hono';
import { calculateCost } from '../lib/cost-calculator';
import { sendTrace, generateTraceId, generateSpanId } from '../lib/trace-sender';

const app = new Hono();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com';

/**
 * POST /chat/completions
 * OpenAI-compatible chat completion proxy
 */
app.post('/chat/completions', async (c) => {
  const startTime = Date.now();
  const traceId = generateTraceId();
  const spanId = generateSpanId();

  try {
    const body = await c.req.json();
    const model = body.model || 'gpt-4o-mini';

    // Extract prompt text
    const messages = body.messages || [];
    const promptText = messages
      .map((m: any) => `[${m.role === 'assistant' ? 'assistant' : 'user'}]\n${m.content}`)
      .join('\n\n');

    // Allow client to provide their own API key via header, fall back to env
    const clientApiKey = c.req.header('Authorization')?.replace('Bearer ', '') || OPENAI_API_KEY;

    if (!clientApiKey) {
      return c.json(
        { error: 'No API key configured. Set OPENAI_API_KEY or pass Authorization header.' },
        500
      );
    }

    // Forward to OpenAI
    const openaiResponse = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientApiKey}`,
      },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - startTime;
    const responseBody = (await openaiResponse.json()) as any;

    if (!openaiResponse.ok) {
      sendTrace({
        traceId,
        spanId,
        model,
        provider: 'openai',
        prompt: promptText,
        response: JSON.stringify(responseBody),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs,
        costUsd: 0,
        status: 'error',
        errorMessage: responseBody?.error?.message || `HTTP ${openaiResponse.status}`,
        endpoint: '/chat/completions',
        source: 'proxy',
      }).catch(() => {});

      return c.json(responseBody, openaiResponse.status as any);
    }

    // Parse token usage
    const usage = responseBody.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;

    // Extract response text
    const responseText = responseBody.choices?.[0]?.message?.content || '';

    // Calculate cost
    const { costUsd, provider } = calculateCost(model, promptTokens, completionTokens);

    // Send trace asynchronously
    sendTrace({
      traceId,
      spanId,
      model,
      provider,
      prompt: promptText,
      response: responseText,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      costUsd,
      status: 'success',
      endpoint: '/chat/completions',
      source: 'proxy',
    }).catch(() => {});

    // Return with Refract headers
    return c.json(responseBody, 200, {
      'X-Refract-Trace-Id': traceId,
      'X-Refract-Latency-Ms': latencyMs.toString(),
      'X-Refract-Cost-Usd': costUsd.toFixed(8),
      'X-Refract-Prompt-Tokens': promptTokens.toString(),
      'X-Refract-Completion-Tokens': completionTokens.toString(),
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    sendTrace({
      traceId,
      spanId,
      model: 'unknown',
      provider: 'openai',
      prompt: '',
      response: '',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs,
      costUsd: 0,
      status: 'error',
      errorMessage,
      endpoint: '/chat/completions',
      source: 'proxy',
    }).catch(() => {});

    return c.json({ error: 'Proxy error', message: errorMessage }, 502);
  }
});

export default app;
