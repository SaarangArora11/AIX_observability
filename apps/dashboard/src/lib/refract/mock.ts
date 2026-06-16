import type { Trace, Metrics, AnalysisResult, Provider, ModelFit } from "./types";

const providers: Provider[] = ["google", "openai", "anthropic"];
const models: Record<Provider, string[]> = {
  google: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-1.5-flash"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  anthropic: ["claude-3-5-sonnet", "claude-3-haiku"],
};
const categories = ["summarization", "code-gen", "classification", "reasoning", "extraction", "translation", "qa"];
const fits: ModelFit[] = ["overkill", "good_fit", "underkill"];

const seed = (s: number) => () => {
  s = (s * 9301 + 49297) % 233280;
  return s / 233280;
};

export function mockTraces(n = 50, seedNum = 42): Trace[] {
  const r = seed(seedNum);
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const provider = providers[Math.floor(r() * 3)];
    const model = models[provider][Math.floor(r() * models[provider].length)];
    const inputTokens = Math.floor(r() * 1800 + 80);
    const outputTokens = Math.floor(r() * 900 + 30);
    const isErr = r() < 0.08;
    const cost = (inputTokens * 0.0000025 + outputTokens * 0.00001) * (provider === "anthropic" ? 1.4 : 1);
    const fit = fits[Math.floor(r() * 3)];
    return {
      id: `trc_${(seedNum + i).toString(36)}${Math.floor(r() * 1e6).toString(36)}`,
      timestamp: new Date(now - i * 1000 * 60 * (r() * 5 + 1)).toISOString(),
      provider,
      model,
      source: r() < 0.65 ? "proxy" : "sdk",
      status: isErr ? "error" : "success",
      latencyMs: Math.floor(r() * 2400 + 180),
      inputTokens,
      outputTokens,
      costUsd: Number(cost.toFixed(5)),
      prompt: samplePrompts[i % samplePrompts.length],
      completion: sampleCompletions[i % sampleCompletions.length],
      category: categories[Math.floor(r() * categories.length)],
      complexity: Number(r().toFixed(2)),
      modelFit: fit,
      suggestedModel: fit === "overkill" ? "gemini-2.0-flash" : model,
      estimatedSavingsUsd: fit === "overkill" ? Number((cost * 0.7).toFixed(5)) : 0,
      spans: [
        { name: "proxy.intercept", startMs: 0, durationMs: 4, kind: "io" },
        { name: "llm.completion", startMs: 5, durationMs: Math.floor(r() * 2000 + 100), kind: "llm" },
        { name: "telemetry.emit", startMs: 5, durationMs: 2, kind: "io" },
      ],
    };
  });
}

export function mockMetrics(traces: Trace[]): Metrics {
  const totalTokens = traces.reduce((a, t) => a + t.inputTokens + t.outputTokens, 0);
  const totalIn = traces.reduce((a, t) => a + t.inputTokens, 0);
  const totalOut = traces.reduce((a, t) => a + t.outputTokens, 0);
  const totalCost = traces.reduce((a, t) => a + t.costUsd, 0);
  const errs = traces.filter((t) => t.status === "error").length;
  const savings = traces.reduce((a, t) => a + (t.estimatedSavingsUsd ?? 0), 0);
  const buckets: Record<string, { input: number; output: number }> = {};
  traces.forEach((t) => {
    const d = new Date(t.timestamp);
    const key = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    buckets[key] ??= { input: 0, output: 0 };
    buckets[key].input += t.inputTokens;
    buckets[key].output += t.outputTokens;
  });
  const tokenFlow = Object.entries(buckets)
    .slice(0, 24)
    .reverse()
    .map(([time, v]) => ({ time, ...v }));
  return {
    totalTraces: traces.length,
    totalTokens,
    totalCostUsd: Number(totalCost.toFixed(4)),
    avgLatencyMs: Math.floor(traces.reduce((a, t) => a + t.latencyMs, 0) / traces.length),
    errorRate: Number((errs / traces.length).toFixed(3)),
    efficiencyScore: Number((totalOut / totalIn).toFixed(3)),
    estimatedSavingsUsd: Number(savings.toFixed(4)),
    tokenFlow,
    modelFit: {
      overkill: traces.filter((t) => t.modelFit === "overkill").length,
      good_fit: traces.filter((t) => t.modelFit === "good_fit").length,
      underkill: traces.filter((t) => t.modelFit === "underkill").length,
    },
    providerMix: providers.map((p) => ({ provider: p, count: traces.filter((t) => t.provider === p).length })),
  };
}

export function mockAnalysis(traceId: string): AnalysisResult {
  const r = seed(traceId.length * 7);
  const fit = fits[Math.floor(r() * 3)];
  return {
    traceId,
    category: categories[Math.floor(r() * categories.length)],
    complexity: Number(r().toFixed(2)),
    modelFit: fit,
    suggestedModel: fit === "overkill" ? "gemini-2.0-flash" : "gemini-2.5-pro",
    estimatedSavingsUsd: fit === "overkill" ? Number((r() * 0.04).toFixed(5)) : 0,
    rationale:
      fit === "overkill"
        ? "Task complexity is low; a flash-tier model would deliver equivalent quality at ~70% lower cost."
        : fit === "underkill"
          ? "Reasoning depth required exceeds this model's typical capability; upgrade recommended."
          : "Model size is well-matched to task complexity. No change recommended.",
    improvements:
      fit === "overkill" 
        ? ["Consider using few-shot examples to ensure the smaller model maintains high accuracy.", "Remove redundant context that may confuse smaller context windows."]
        : fit === "underkill"
          ? ["Break the prompt down into a multi-step chain of thought.", "Explicitly define the persona and constraints to guide the reasoning."]
          : ["The prompt is well-structured.", "Consider adding edge-case handling instructions for robustness."],
    mock: true,
  };
}

const samplePrompts = [
  "Summarize the attached quarterly earnings call into 5 bullet points for an investor brief.",
  "Refactor this React component to use hooks and write unit tests with Vitest.",
  "Classify the following support ticket: 'My order #4421 hasn't arrived after 2 weeks.'",
  "Translate the user manual section below from English to Japanese, preserving formatting.",
  "Extract all named entities (PERSON, ORG, LOCATION) from the article snippet.",
  "What is 2+2?",
  "Plan a 7-day Tokyo itinerary for two adults interested in food and architecture.",
  "Generate a SQL migration to add a `deleted_at` timestamp to the `users` table.",
];
const sampleCompletions = [
  "• Revenue up 12% YoY\n• Cloud segment +28%\n• Operating margin expanded 140bps...",
  "Here's the refactored component using useState and useEffect, plus a Vitest suite...",
  "Category: shipping_delay. Suggested action: trigger carrier inquiry workflow.",
  "ユーザーマニュアル — 第3章...",
  '[{"type":"PERSON","value":"Ada Lovelace"},{"type":"ORG","value":"Refract"}]',
  "4",
  "Day 1: Asakusa & Senso-ji; Day 2: Shibuya, Meiji Shrine; Day 3: teamLab Planets...",
  "ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;",
];
