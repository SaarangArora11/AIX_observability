export type Provider = "google" | "openai" | "anthropic";
export type TraceStatus = "success" | "error" | "pending";
export type ModelFit = "overkill" | "good_fit" | "underkill";
export type Source = "sdk" | "proxy";

export interface Trace {
  id: string;
  timestamp: string;
  provider: Provider;
  model: string;
  source: Source;
  status: TraceStatus;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  prompt: string;
  completion: string;
  category?: string;
  complexity?: number; // 0..1
  modelFit?: ModelFit;
  suggestedModel?: string;
  estimatedSavingsUsd?: number;
  spans?: Span[];
}

export interface Span {
  name: string;
  startMs: number;
  durationMs: number;
  kind: "llm" | "tool" | "io";
}

export interface Metrics {
  totalTraces: number;
  totalTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  errorRate: number;
  efficiencyScore: number; // output / input
  estimatedSavingsUsd: number;
  tokenFlow: { time: string; input: number; output: number }[];
  modelFit: { overkill: number; good_fit: number; underkill: number };
  providerMix: { provider: Provider; count: number }[];
}

export interface AnalysisResult {
  traceId: string;
  category: string;
  complexity: number;
  modelFit: ModelFit;
  suggestedModel: string;
  estimatedSavingsUsd: number;
  rationale: string;
  improvements?: string[];
  mock?: boolean;
}
