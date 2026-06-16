/**
 * Model pricing table (cost per 1M tokens in USD)
 * Used to calculate cost_usd for each proxied request.
 */

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  provider: 'google' | 'openai' | 'anthropic' | 'cohere' | 'other';
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Google Gemini
  'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4, provider: 'google' },
  'gemini-2.0-flash-lite': { inputPer1M: 0.02, outputPer1M: 0.1, provider: 'google' },
  'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.6, provider: 'google' },
  'gemini-2.5-flash-preview-05-20': { inputPer1M: 0.15, outputPer1M: 0.6, provider: 'google' },
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.0, provider: 'google' },
  'gemini-2.5-pro-preview-06-05': { inputPer1M: 1.25, outputPer1M: 10.0, provider: 'google' },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.3, provider: 'google' },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.0, provider: 'google' },

  // OpenAI
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0, provider: 'openai' },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6, provider: 'openai' },
  'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0, provider: 'openai' },
  'gpt-3.5-turbo': { inputPer1M: 0.5, outputPer1M: 1.5, provider: 'openai' },
  o1: { inputPer1M: 15.0, outputPer1M: 60.0, provider: 'openai' },
  'o1-mini': { inputPer1M: 1.1, outputPer1M: 4.4, provider: 'openai' },
  'o3-mini': { inputPer1M: 1.1, outputPer1M: 4.4, provider: 'openai' },

  // Anthropic
  'claude-sonnet-4-20250514': { inputPer1M: 3.0, outputPer1M: 15.0, provider: 'anthropic' },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0, provider: 'anthropic' },
  'claude-3-5-haiku-20241022': { inputPer1M: 0.8, outputPer1M: 4.0, provider: 'anthropic' },
  'claude-3-opus-20240229': { inputPer1M: 15.0, outputPer1M: 75.0, provider: 'anthropic' },
};

/**
 * Calculate the USD cost for a given model and token counts.
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): { costUsd: number; provider: string } {
  // Try exact match first, then prefix match
  const pricing = MODEL_PRICING[model] || findPricingByPrefix(model);

  if (!pricing) {
    console.warn(`No pricing found for model "${model}", using zero cost`);
    return { costUsd: 0, provider: guessProvider(model) };
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;

  return {
    costUsd: inputCost + outputCost,
    provider: pricing.provider,
  };
}

function findPricingByPrefix(model: string): ModelPricing | undefined {
  for (const [key, value] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key)) return value;
  }
  return undefined;
}

function guessProvider(model: string): string {
  if (model.startsWith('gemini')) return 'google';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('claude')) return 'anthropic';
  return 'other';
}

/**
 * Get model tier for model-fit analysis
 */
export function getModelTier(model: string): 'cheap' | 'mid' | 'expensive' {
  const pricing = MODEL_PRICING[model] || findPricingByPrefix(model);
  if (!pricing) return 'mid';

  const avgCostPer1M = (pricing.inputPer1M + pricing.outputPer1M) / 2;
  if (avgCostPer1M < 0.5) return 'cheap';
  if (avgCostPer1M < 5.0) return 'mid';
  return 'expensive';
}
