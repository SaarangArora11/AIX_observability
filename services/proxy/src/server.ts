/**
 * Refract Proxy Gateway
 *
 * A transparent LLM proxy that sits between client applications and LLM providers.
 * Captures traces, calculates costs, and sends telemetry to the Refract platform.
 *
 * Architecture:
 *   Client App → Refract Proxy (:8090) → LLM Provider (Gemini/OpenAI/Anthropic)
 *                     ↓ (async)
 *              Ingestion Service (:8080) → PostgreSQL
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import googleRoutes from './routes/google';
import openaiRoutes from './routes/openai';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Refract-Service-Name', 'x-goog-api-key'],
    exposeHeaders: [
      'X-Refract-Trace-Id',
      'X-Refract-Latency-Ms',
      'X-Refract-Cost-Usd',
      'X-Refract-Prompt-Tokens',
      'X-Refract-Completion-Tokens',
      'X-Refract-Efficiency',
    ],
  })
);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'refract-proxy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    providers: {
      google: !!process.env.GEMINI_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    },
  });
});

// Google Gemini proxy routes
// Usage: POST /v1/proxy/google/models/gemini-2.0-flash:generateContent
app.route('/v1/proxy/google', googleRoutes);

// OpenAI-compatible proxy routes
// Usage: POST /v1/proxy/openai/chat/completions
app.route('/v1/proxy/openai', openaiRoutes);

// Serve demo chat interface
app.get('/demo', async (c) => {
  try {
    const html = await Bun.file(new URL('./demo/index.html', import.meta.url).pathname).text();
    return c.html(html);
  } catch {
    // Fallback: try relative path
    try {
      const html = await Bun.file('./src/demo/index.html').text();
      return c.html(html);
    } catch {
      return c.html('<h1>Demo not found</h1><p>Run from the services/proxy directory.</p>', 404);
    }
  }
});

// Info endpoint — tells clients how to use the proxy
app.get('/', (c) => {
  return c.json({
    name: 'Refract Proxy Gateway',
    version: '0.1.0',
    description: 'Transparent LLM proxy for observability and cost tracking',
    endpoints: {
      google_gemini: {
        path: '/v1/proxy/google/models/{model}:{method}',
        example: 'POST /v1/proxy/google/models/gemini-2.0-flash:generateContent',
      },
      openai_compatible: {
        path: '/v1/proxy/openai/chat/completions',
        example: 'POST /v1/proxy/openai/chat/completions',
      },
      demo_chat: {
        path: '/demo',
        description: 'Interactive chat interface for testing',
      },
      health: {
        path: '/health',
        description: 'Service health check',
      },
    },
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Proxy error:', err);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

// Start server
const port = parseInt(process.env.PROXY_PORT || '8090');
console.log(`🔀 Refract Proxy Gateway starting on port ${port}...`);
console.log(
  `   Google Gemini: ${process.env.GEMINI_API_KEY ? '✅ configured' : '❌ GEMINI_API_KEY missing'}`
);
console.log(
  `   OpenAI:        ${process.env.OPENAI_API_KEY ? '✅ configured' : '⚠️  OPENAI_API_KEY not set'}`
);
console.log(`   Ingestion URL: ${process.env.INGESTION_URL || 'http://localhost:8080'}`);
console.log(`   Demo Chat:     http://localhost:${port}/demo`);

export default {
  port,
  fetch: app.fetch,
};
