/**
 * Google Gemini Proxy Route
 * 
 * Handles requests to Google's Generative AI API (generateContent).
 * Acts as a transparent middleman:
 *   Client → Refract Proxy → Google Gemini API
 *   Client ← Refract Proxy ← Google Gemini API (+ async trace logging)
 */

import { Hono } from 'hono';
import { calculateCost } from '../lib/cost-calculator';
import { sendTrace, generateTraceId, generateSpanId } from '../lib/trace-sender';

const app = new Hono();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * POST /models/:model::method
 * Proxies to Google Gemini generateContent / streamGenerateContent
 * 
 * Example: POST /models/gemini-2.0-flash:generateContent
 */
app.post('/models/:modelAndMethod', async (c) => {
  const startTime = Date.now();
  const traceId = generateTraceId();
  const spanId = generateSpanId();

  const modelAndMethod = c.req.param('modelAndMethod');
  const [model, method] = modelAndMethod.split(':');

  if (!GEMINI_API_KEY) {
    return c.json({ error: 'GEMINI_API_KEY not configured on proxy' }, 500);
  }

  if (!model || !method) {
    return c.json({ error: 'Invalid path. Expected /models/{model}:{method}' }, 400);
  }

  try {
    // Read the request body
    const body = await c.req.json();

    // Extract prompt text for logging
    const promptText = extractPromptText(body);

    // Forward to Google Gemini API
    const geminiUrl = `${GEMINI_BASE_URL}/models/${model}:${method}?key=${GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - startTime;
    const responseBody = await geminiResponse.json() as any;

    if (!geminiResponse.ok) {
      // Forward error response to client, but still log the trace
      sendTrace({
        traceId,
        spanId,
        model,
        provider: 'google',
        prompt: promptText,
        response: JSON.stringify(responseBody),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs,
        costUsd: 0,
        status: 'error',
        errorMessage: responseBody?.error?.message || `HTTP ${geminiResponse.status}`,
        endpoint: `/models/${model}:${method}`,
        source: 'proxy',
      }).catch(() => {}); // fire-and-forget

      return c.json(responseBody, geminiResponse.status as any);
    }

    // Parse token usage from response
    const usageMetadata = responseBody.usageMetadata || {};
    const promptTokens = usageMetadata.promptTokenCount || 0;
    const completionTokens = usageMetadata.candidatesTokenCount || usageMetadata.totalTokenCount - usageMetadata.promptTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || promptTokens + completionTokens;

    // Extract response text
    const responseText = extractResponseText(responseBody);

    // Calculate cost
    const { costUsd } = calculateCost(model, promptTokens, completionTokens);

    // Calculate prompt efficiency (output/input ratio)
    const promptEfficiency = promptTokens > 0 ? completionTokens / promptTokens : 0;

    // Send trace asynchronously (fire-and-forget)
    sendTrace({
      traceId,
      spanId,
      model,
      provider: 'google',
      prompt: promptText,
      response: responseText,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      costUsd,
      status: 'success',
      endpoint: `/models/${model}:${method}`,
      source: 'proxy',
    }).catch(() => {}); // fire-and-forget

    // Add Refract headers to help clients correlate with dashboard
    const headers: Record<string, string> = {
      'X-Refract-Trace-Id': traceId,
      'X-Refract-Latency-Ms': latencyMs.toString(),
      'X-Refract-Cost-Usd': costUsd.toFixed(8),
      'X-Refract-Prompt-Tokens': promptTokens.toString(),
      'X-Refract-Completion-Tokens': completionTokens.toString(),
      'X-Refract-Efficiency': promptEfficiency.toFixed(4),
    };

    // Return the unmodified Gemini response with extra headers
    return c.json(responseBody, 200, headers);
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown proxy error';

    sendTrace({
      traceId,
      spanId,
      model: model || 'unknown',
      provider: 'google',
      prompt: '',
      response: '',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs,
      costUsd: 0,
      status: 'error',
      errorMessage,
      endpoint: `/models/${model}:${method}`,
      source: 'proxy',
    }).catch(() => {});

    return c.json({ error: 'Proxy error', message: errorMessage }, 502);
  }
});

/**
 * Extract prompt text from Gemini request body
 */
function extractPromptText(body: any): string {
  try {
    const contents = body.contents || [];
    const parts: string[] = [];
    for (const content of contents) {
      for (const part of content.parts || []) {
        if (part.text) parts.push(part.text);
      }
    }
    return parts.join('\n');
  } catch {
    return '';
  }
}

/**
 * Extract response text from Gemini response body
 */
function extractResponseText(responseBody: any): string {
  try {
    const candidates = responseBody.candidates || [];
    const parts: string[] = [];
    for (const candidate of candidates) {
      for (const part of candidate.content?.parts || []) {
        if (part.text) parts.push(part.text);
      }
    }
    return parts.join('\n');
  } catch {
    return '';
  }
}

export default app;
