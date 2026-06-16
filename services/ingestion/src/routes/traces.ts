import { Hono } from 'hono';
import type { OTLPTraceRequest } from '@refract/schema';
import { parseOTLPTraces } from '../parsers/otlp-parser';
import { transformOTLPBatch } from '../transformers/otlp-transformer';
import {
  getDatabase,
  insertTracesBatch,
  buildTraceQuery,
  getTraceMetrics,
} from '../database/client';
import { publishTraces, isNATSConnected } from '../queue/nats-client';
import { rateLimitMiddleware, incrementTraceCount } from '../middleware/rate-limit';
import type { AppVariables } from '../types/hono';

const traces = new Hono<{ Variables: AppVariables }>();

// Apply rate limiting to all trace endpoints
traces.use('/v1/traces', rateLimitMiddleware);

/**
 * POST /v1/traces
 * OpenTelemetry Protocol (OTLP) trace ingestion endpoint
 */
traces.post('/v1/traces', async (c) => {
  try {
    // Get customer ID from auth middleware
    const customerId = c.get('customerId') as string;

    if (!customerId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Parse request body as OTLP trace request
    const otlpData: OTLPTraceRequest = await c.req.json();

    // Validate request structure
    if (!otlpData.resourceSpans || !Array.isArray(otlpData.resourceSpans)) {
      return c.json(
        {
          error: 'Invalid OTLP request format',
          message: 'Expected resourceSpans array in request body',
        },
        400
      );
    }

    // Parse OTLP spans (flatten nested structure)
    const parsedSpans = parseOTLPTraces(otlpData);

    if (parsedSpans.length === 0) {
      return c.json(
        {
          message: 'No spans to process',
          count: 0,
        },
        200
      );
    }

    // Transform to Refract trace format
    const schemaTraces = transformOTLPBatch(parsedSpans, customerId);

    const dbTraces = schemaTraces.map((t) => ({
      traceId: t.trace_id,
      spanId: t.span_id,
      parentSpanId: t.parent_span_id,
      customerId: t.customer_id,
      timestamp: t.timestamp,
      serviceName: t.service_name,
      endpoint: t.endpoint,
      environment: t.environment,
      model: t.model,
      provider: t.provider,
      prompt: t.prompt,
      response: t.response,
      tokens: t.tokens,
      promptTokens: t.prompt_tokens,
      completionTokens: t.completion_tokens,
      latencyMs: t.latency_ms,
      costUsd: t.cost_usd,
      metadata: t.metadata,
      tags: t.tags,
      status: t.status,
      errorMessage: t.error_message,
      source: t.source,
    }));

    // Store in PostgreSQL (synchronous for immediate query availability)
    const db = getDatabase();
    await insertTracesBatch(db, dbTraces as any);

    // Increment rate limit counter after successful ingestion
    const rateLimitKey = c.get('rateLimitKey') as string | undefined;
    if (rateLimitKey) {
      // Don't await - increment async to keep response fast
      incrementTraceCount(rateLimitKey, schemaTraces.length).catch((err) => {
        console.error('Failed to increment trace count:', err);
        // Don't fail the request if counter increment fails
      });
    }

    // Publish to NATS for async alert processing (fire and forget)
    // This keeps the HTTP response fast while allowing background analysis
    if (isNATSConnected()) {
      // Don't await - publish async to keep response <20ms
      publishTraces(schemaTraces).catch((err) => {
        console.error('Failed to publish traces to NATS:', err);
        // Don't fail the request if NATS publish fails
        // Traces are already stored in DB
      });
    } else {
      console.warn('NATS not connected - skipping async alert processing');
    }

    // Return success response (OTLP spec requires empty response or status)
    return c.json(
      {
        message: 'Traces ingested successfully',
        count: schemaTraces.length,
      },
      200
    );
  } catch (error) {
    console.error('Error ingesting traces:', error);

    // Check for specific error types
    if (error instanceof SyntaxError) {
      return c.json(
        {
          error: 'Invalid JSON',
          message: error.message,
        },
        400
      );
    }

    return c.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /v1/traces
 * Query traces (for debugging/testing)
 */
traces.get('/v1/traces', async (c) => {
  try {
    const customerId = c.get('customerId') as string;

    if (!customerId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Parse query parameters
    const environment = c.req.query('environment') as 'live' | 'test' | undefined;
    const status = c.req.query('status') as 'success' | 'error' | undefined;
    const serviceName = c.req.query('service_name');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    // Optional time range filters
    const startTime = c.req.query('start_time') ? new Date(c.req.query('start_time')!) : undefined;
    const endTime = c.req.query('end_time') ? new Date(c.req.query('end_time')!) : undefined;

    // Query database
    const db = getDatabase();
    const result = await buildTraceQuery(db, {
      customerId,
      environment,
      status,
      serviceName,
      startTime,
      endTime,
      limit,
      offset,
    });

    return c.json({
      traces: result,
      count: result.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error querying traces:', error);

    return c.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /v1/traces/metrics
 * Get aggregated metrics
 */
traces.get('/v1/traces/metrics', async (c) => {
  try {
    const customerId = c.get('customerId') as string;

    if (!customerId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const environment = c.req.query('environment') as 'live' | 'test' | undefined;
    const startTime = c.req.query('start_time') ? new Date(c.req.query('start_time')!) : undefined;
    const endTime = c.req.query('end_time') ? new Date(c.req.query('end_time')!) : undefined;

    const db = getDatabase();
    const metrics = await getTraceMetrics(db, {
      customerId,
      environment,
      startTime,
      endTime,
    });

    return c.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);

    return c.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default traces;
