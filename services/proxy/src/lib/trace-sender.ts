/**
 * Trace Sender — Asynchronously sends trace data to the Refract Ingestion Service.
 *
 * This is the key integration point: the proxy captures LLM call metadata
 * and sends it to the ingestion service in OTLP-compatible format.
 * Fire-and-forget to avoid adding latency to the proxied request.
 */

const INGESTION_URL = process.env.INGESTION_URL || 'http://localhost:8080';

export interface TracePayload {
  traceId: string;
  spanId: string;
  model: string;
  provider: string;
  prompt: string;
  response: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd: number;
  status: 'success' | 'error';
  errorMessage?: string;
  endpoint: string;
  source: 'proxy' | 'sdk';
  serviceName?: string;
}

/**
 * Generate a random hex string of a given length
 */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a unique trace ID (32 hex chars)
 */
export function generateTraceId(): string {
  return randomHex(16);
}

/**
 * Generate a unique span ID (16 hex chars)
 */
export function generateSpanId(): string {
  return randomHex(8);
}

/**
 * Send a trace to the Refract Ingestion Service.
 * This constructs an OTLP-compatible payload and POSTs it.
 *
 * Fire-and-forget: errors are logged but not thrown.
 */
export async function sendTrace(payload: TracePayload): Promise<void> {
  try {
    const now = Date.now();
    const startTimeNanos = (now - payload.latencyMs) * 1_000_000;
    const endTimeNanos = now * 1_000_000;

    const otlpPayload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: payload.serviceName || 'refract-proxy' },
              },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'refract-proxy', version: '0.1.0' },
              spans: [
                {
                  traceId: payload.traceId,
                  spanId: payload.spanId,
                  name: payload.endpoint,
                  kind: 3, // CLIENT
                  startTimeUnixNano: startTimeNanos.toString(),
                  endTimeUnixNano: endTimeNanos.toString(),
                  status: {
                    code: payload.status === 'success' ? 1 : 2,
                    message: payload.errorMessage || '',
                  },
                  attributes: [
                    { key: 'gen_ai.system', value: { stringValue: payload.provider } },
                    { key: 'gen_ai.request.model', value: { stringValue: payload.model } },
                    {
                      key: 'gen_ai.usage.prompt_tokens',
                      value: { intValue: payload.promptTokens },
                    },
                    {
                      key: 'gen_ai.usage.completion_tokens',
                      value: { intValue: payload.completionTokens },
                    },
                    { key: 'gen_ai.usage.total_tokens', value: { intValue: payload.totalTokens } },
                    { key: 'gen_ai.prompt', value: { stringValue: payload.prompt } },
                    { key: 'gen_ai.response', value: { stringValue: payload.response } },
                    { key: 'gen_ai.cost', value: { doubleValue: payload.costUsd } },
                    { key: 'refract.source', value: { stringValue: payload.source } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(`${INGESTION_URL}/v1/traces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(otlpPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[trace-sender] Failed to send trace: ${response.status} ${errorText}`);
    } else {
      console.log(
        `[trace-sender] Trace sent: ${payload.traceId} (${payload.model}, $${payload.costUsd.toFixed(6)})`
      );
    }
  } catch (error) {
    console.error('[trace-sender] Error sending trace:', error);
    // Fire-and-forget: don't rethrow
  }
}
