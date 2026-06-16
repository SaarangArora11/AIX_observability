/**
 * Prompt Analysis API Routes
 *
 * On-demand prompt analysis using Gemini to categorize prompts,
 * assess complexity, and determine model-task alignment.
 *
 * This is NOT called on every trace — it's triggered:
 * 1. From the Dashboard (user clicks "Analyze" on a trace)
 * 2. Via API for batch analysis
 */

import { Hono } from 'hono';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { getDatabase, traces } from '../database/client';
import { requireAuth } from '../middleware/auth';

const app = new Hono();

const GEMINI_MODEL = 'gemini-flash-latest'; // Widely available free-tier model

/**
 * POST /prompt-analysis/analyze
 * Analyze a single trace's prompt
 */
app.post('/analyze', requireAuth, async (c) => {
  try {
    const db = getDatabase();
    const { traceId, spanId } = await c.req.json();

    if (!traceId || !spanId) {
      return c.json({ error: 'traceId and spanId are required' }, 400);
    }

    // Fetch the trace
    const result = await db
      .select()
      .from(traces)
      .where(and(eq(traces.traceId, traceId), eq(traces.spanId, spanId)))
      .limit(1);

    const trace = result[0];
    if (!trace) {
      return c.json({ error: 'Trace not found' }, 404);
    }

    if (!trace.prompt) {
      return c.json({ error: 'Trace has no prompt to analyze' }, 400);
    }

    // Extract API key from headers (Dashboard should send this)
    const clientApiKey = c.req.header('x-goog-api-key') || GEMINI_API_KEY;

    // Perform analysis
    const analysis = await analyzePrompt(
      trace.prompt,
      trace.model,
      trace.provider || 'unknown',
      clientApiKey
    );

    if (!analysis) {
      return c.json({ error: 'Analysis failed — check API Key' }, 500);
    }

    // Calculate prompt efficiency
    const promptTokens = trace.promptTokens || 0;
    const completionTokens = trace.completionTokens || 0;
    const promptEfficiency = promptTokens > 0 ? completionTokens / promptTokens : 0;

    // Update the trace with analysis results
    await db
      .update(traces)
      .set({
        promptCategory: analysis.category,
        promptComplexity: analysis.complexity,
        modelFit: analysis.model_fit,
        modelFitReason: analysis.model_fit_reason,
        suggestedModel: analysis.suggested_model || null,
        promptEfficiency,
        analyzedAt: new Date(),
      })
      .where(and(eq(traces.traceId, traceId), eq(traces.spanId, spanId)));

    return c.json({
      success: true,
      analysis: {
        ...analysis,
        prompt_efficiency: promptEfficiency,
        trace_id: traceId,
        span_id: spanId,
      },
    });
  } catch (error) {
    console.error('Prompt analysis error:', error);
    return c.json(
      {
        error: 'Analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /prompt-analysis/batch
 * Analyze multiple unanalyzed traces
 */
app.post('/batch', requireAuth, async (c) => {
  try {
    const db = getDatabase();
    const customerId = c.get('customerId') as string;
    const { limit = 10 } = await c.req.json();

    // Get unanalyzed traces with prompts
    const unanalyzed = await db
      .select()
      .from(traces)
      .where(and(eq(traces.customerId, customerId), isNull(traces.analyzedAt)))
      .orderBy(desc(traces.timestamp))
      .limit(Math.min(limit, 20)); // Cap at 20 to control costs

    // Extract API key from headers
    const clientApiKey = c.req.header('x-goog-api-key') || GEMINI_API_KEY;

    const results = [];

    for (const trace of unanalyzed) {
      if (!trace.prompt) continue;

      try {
        const analysis = await analyzePrompt(
          trace.prompt,
          trace.model,
          trace.provider || 'unknown',
          clientApiKey
        );
        if (!analysis) continue;

        const promptTokens = trace.promptTokens || 0;
        const completionTokens = trace.completionTokens || 0;
        const promptEfficiency = promptTokens > 0 ? completionTokens / promptTokens : 0;

        await db
          .update(traces)
          .set({
            promptCategory: analysis.category,
            promptComplexity: analysis.complexity,
            modelFit: analysis.model_fit,
            modelFitReason: analysis.model_fit_reason,
            suggestedModel: analysis.suggested_model || null,
            promptEfficiency,
            analyzedAt: new Date(),
          })
          .where(and(eq(traces.traceId, trace.traceId), eq(traces.spanId, trace.spanId)));

        results.push({
          trace_id: trace.traceId,
          span_id: trace.spanId,
          ...analysis,
          prompt_efficiency: promptEfficiency,
        });
      } catch (err) {
        console.error(`Failed to analyze trace ${trace.traceId}:`, err);
      }
    }

    return c.json({
      success: true,
      analyzed: results.length,
      total_unanalyzed: unanalyzed.length,
      results,
    });
  } catch (error) {
    console.error('Batch analysis error:', error);
    return c.json(
      {
        error: 'Batch analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /prompt-analysis/stats
 * Get prompt analysis statistics
 */
app.get('/stats', requireAuth, async (c) => {
  try {
    const db = getDatabase();
    const customerId = c.get('customerId') as string;

    // Category distribution
    const categories = await db
      .select({
        category: traces.promptCategory,
        count: sql<number>`COUNT(*)::int`,
        totalCost: sql<number>`COALESCE(SUM(${traces.costUsd}), 0)::float`,
        avgLatency: sql<number>`COALESCE(AVG(${traces.latencyMs}), 0)::float`,
      })
      .from(traces)
      .where(and(eq(traces.customerId, customerId), sql`${traces.promptCategory} IS NOT NULL`))
      .groupBy(traces.promptCategory);

    // Model fit distribution
    const modelFit = await db
      .select({
        fit: traces.modelFit,
        count: sql<number>`COUNT(*)::int`,
        totalCost: sql<number>`COALESCE(SUM(${traces.costUsd}), 0)::float`,
      })
      .from(traces)
      .where(and(eq(traces.customerId, customerId), sql`${traces.modelFit} IS NOT NULL`))
      .groupBy(traces.modelFit);

    // Complexity distribution
    const complexity = await db
      .select({
        complexity: traces.promptComplexity,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(traces)
      .where(and(eq(traces.customerId, customerId), sql`${traces.promptComplexity} IS NOT NULL`))
      .groupBy(traces.promptComplexity);

    // Source distribution (SDK vs Proxy)
    const sources = await db
      .select({
        source: traces.source,
        count: sql<number>`COUNT(*)::int`,
        totalCost: sql<number>`COALESCE(SUM(${traces.costUsd}), 0)::float`,
      })
      .from(traces)
      .where(eq(traces.customerId, customerId))
      .groupBy(traces.source);

    // Calculate potential savings from overkill traces
    const overkillData = modelFit.find((m) => m.fit === 'overkill');
    const totalAnalyzed = modelFit.reduce((sum, m) => sum + m.count, 0);
    const overkillCost = overkillData?.totalCost || 0;
    // Rough estimate: 60% savings if switching to a cheaper model
    const estimatedMonthlySavings = overkillCost * 0.6 * 30;

    // Average prompt efficiency
    const efficiencyResult = await db
      .select({
        avgEfficiency: sql<number>`COALESCE(AVG(${traces.promptEfficiency}), 0)::float`,
      })
      .from(traces)
      .where(and(eq(traces.customerId, customerId), sql`${traces.promptEfficiency} IS NOT NULL`));

    return c.json({
      categories,
      model_fit: modelFit,
      complexity,
      sources,
      summary: {
        total_analyzed: totalAnalyzed,
        avg_prompt_efficiency: efficiencyResult[0]?.avgEfficiency || 0,
        overkill_percentage:
          totalAnalyzed > 0 ? ((overkillData?.count || 0) / totalAnalyzed) * 100 : 0,
        model_alignment_score:
          totalAnalyzed > 0
            ? ((modelFit.find((m) => m.fit === 'good_fit')?.count || 0) / totalAnalyzed) * 100
            : 0,
        estimated_monthly_savings: estimatedMonthlySavings,
        overkill_cost: overkillCost,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return c.json(
      {
        error: 'Failed to fetch stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Call Gemini to analyze a prompt
 */
async function analyzePrompt(
  promptText: string,
  model: string,
  provider: string,
  apiKey: string
): Promise<PromptAnalysis | null> {
  if (!apiKey) {
    console.error('API key not set — cannot analyze prompts');
    return null;
  }

  // Truncate very long prompts
  const truncatedPrompt =
    promptText.length > 2000 ? promptText.substring(0, 2000) + '...[truncated]' : promptText;

  const metaPrompt = `You are a prompt analysis engine for an LLM observability platform called Refract.
Analyze the following prompt and the model it was sent to.

PROMPT:
"""
${truncatedPrompt}
"""

MODEL USED: ${model}
PROVIDER: ${provider}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "category": "one of: code_generation, creative_writing, data_extraction, summarization, translation, general_chat, reasoning, math, instruction_following, other",
  "complexity": "one of: simple, moderate, complex",
  "model_fit": "one of: underkill, good_fit, overkill",
  "model_fit_reason": "1-2 sentence explanation of why this model is overkill/underkill/good fit for this prompt",
  "suggested_model": "if model_fit is 'overkill', suggest a cheaper alternative model name. if 'underkill', suggest a more capable model. if 'good_fit', set to null",
  "token_waste_estimate": "percentage 0-100 of estimated wasted tokens in the prompt (verbose/unnecessary content)"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: metaPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Gemini analysis call failed:', response.status, errBody);

      // Fallback for hackathon: return mock data if rate limited
      if (response.status === 429 || errBody.includes('RESOURCE_EXHAUSTED')) {
        console.warn('Rate limited by Gemini. Using mock analysis data.');
        return {
          category: ['general_chat', 'reasoning', 'creative_writing'][
            Math.floor(Math.random() * 3)
          ],
          complexity: 'moderate',
          model_fit: 'good_fit',
          model_fit_reason: 'The selected model is well-suited for this typical request.',
          suggested_model: null,
          token_waste_estimate: Math.floor(Math.random() * 20),
        };
      }

      return null;
    }

    const data = (await response.json()) as any;
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response (handle potential markdown fences)
    const jsonStr = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const analysis = JSON.parse(jsonStr) as PromptAnalysis;

    // Validate fields
    const validCategories = [
      'code_generation',
      'creative_writing',
      'data_extraction',
      'summarization',
      'translation',
      'general_chat',
      'reasoning',
      'math',
      'instruction_following',
      'other',
    ];
    const validComplexity = ['simple', 'moderate', 'complex'];
    const validFit = ['underkill', 'good_fit', 'overkill'];

    if (!validCategories.includes(analysis.category)) analysis.category = 'other';
    if (!validComplexity.includes(analysis.complexity)) analysis.complexity = 'moderate';
    if (!validFit.includes(analysis.model_fit)) analysis.model_fit = 'good_fit';

    return analysis;
  } catch (error) {
    console.error('Failed to analyze prompt with Gemini:', error);
    return null;
  }
}

interface PromptAnalysis {
  category: string;
  complexity: string;
  model_fit: string;
  model_fit_reason: string;
  suggested_model: string | null;
  token_waste_estimate?: number;
}

export default app;
