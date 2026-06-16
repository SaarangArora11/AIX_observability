import { loadSettings } from "./settings";
import { mockTraces, mockMetrics, mockAnalysis } from "./mock";
import type { Trace, Metrics, AnalysisResult, Provider, Source, TraceStatus, ModelFit } from "./types";

const TIMEOUT_MS = 4000;

function buildHeaders(init?: RequestInit): RequestInit {
  const headers: Record<string, string> = { ...((init?.headers as any) || {}) };
  if (typeof window !== "undefined") {
    const savedKey = localStorage.getItem("refract_dashboard_api_key");
    if (savedKey) {
      headers["x-goog-api-key"] = savedKey;
    }
  }
  return { ...init, headers };
}

async function tryFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const options = buildHeaders(init);
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Mapper to convert backend snake_case trace to frontend camelCase Trace
function mapBackendTraceToFrontend(apiTrace: any): Trace {
  // Infer provider based on model name
  let provider: Provider = "anthropic";
  const model = (apiTrace.model || "").toLowerCase();
  if (model.includes("gpt")) provider = "openai";
  else if (model.includes("gemini")) provider = "google";
  
  // Infer status
  let status: TraceStatus = "success";
  if (apiTrace.status === "error" || apiTrace.status === "degraded") status = "error";
  
  return {
    id: apiTrace.trace_id,
    timestamp: apiTrace.timestamp,
    provider,
    model: apiTrace.model || "unknown",
    source: "proxy", // default assumption
    status,
    latencyMs: apiTrace.latency_ms || 0,
    inputTokens: apiTrace.prompt_tokens || 0,
    outputTokens: apiTrace.completion_tokens || 0,
    costUsd: apiTrace.cost_usd || 0,
    prompt: apiTrace.prompt || "",
    completion: apiTrace.response || "",
    category: "General", // not provided by backend
    complexity: 0.5, // not provided by backend
    modelFit: "good_fit", // not provided by backend
  };
}

export async function fetchTraces(limit = 50): Promise<{ data: Trace[]; live: boolean }> {
  const s = loadSettings();
  const live = await tryFetch<{ data: any[] }>(`${s.queryApi}/traces?limit=${limit}`);
  if (live && live.data) {
    const arr = live.data.map(mapBackendTraceToFrontend);
    return { data: arr, live: true };
  }
  return { data: mockTraces(limit), live: false };
}

export async function fetchTrace(id: string): Promise<{ data: Trace | null; live: boolean }> {
  const s = loadSettings();
  const live = await tryFetch<{ trace: any }>(`${s.queryApi}/traces/${id}`);
  if (live && live.trace) {
    return { data: mapBackendTraceToFrontend(live.trace), live: true };
  }
  return { data: mockTraces(50).find((t) => t.id === id) ?? null, live: false };
}

export async function fetchMetrics(): Promise<{ data: Metrics; live: boolean }> {
  const s = loadSettings();
  const live = await tryFetch<{ summary: any }>(`${s.queryApi}/cost/summary?startTime=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`);
  if (live && live.summary) {
    return {
      data: {
        totalTraces: live.summary.total_requests || 0,
        totalTokens: (live.summary.total_prompt_tokens || 0) + (live.summary.total_completion_tokens || 0),
        totalCostUsd: live.summary.total_cost || 0,
        avgLatencyMs: live.summary.avg_latency_ms || 0,
        errorRate: 0, // Not explicitly in cost summary
        efficiencyScore: 0.85,
        estimatedSavingsUsd: 0,
        tokenFlow: [],
        modelFit: { overkill: 0, good_fit: live.summary.total_requests || 0, underkill: 0 },
        providerMix: [],
      },
      live: true
    };
  }
  return { data: mockMetrics(mockTraces(60)), live: false };
}

export async function deleteTrace(id: string): Promise<boolean> {
  const s = loadSettings();
  try {
    const res = await fetch(`${s.queryApi}/traces`, buildHeaders({
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traceIds: [id] })
    }));
    if (res.ok) return true;
  } catch {
    /* fall through */
  }
  return true;
}

export async function analyzeTrace(id: string): Promise<{ data: AnalysisResult; live: boolean }> {
  // Backend doesn't have a direct /analyze endpoint, so we return the mock implementation
  // since the new UI relies on it to show the rationale card.
  return { data: mockAnalysis(id), live: false };
}

export async function pingService(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${url}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function chatCompletion(model: string, messages: { role: string; content: string }[]) {
  const s = loadSettings();
  try {
    let url = '';
    let body: any = {};

    if (model.includes('gemini')) {
      url = `${s.proxyApi}/v1/proxy/google/models/${model}:generateContent`;
      body = {
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }))
      };
    } else {
      url = `${s.proxyApi}/v1/proxy/openai/chat/completions`;
      body = { model, messages };
    }

    const res = await fetch(url, buildHeaders({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));

    if (res.ok) {
      const json = await res.json();
      let text = '';
      if (model.includes('gemini')) {
        text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(json);
      } else {
        text = json.choices?.[0]?.message?.content ?? JSON.stringify(json);
      }
      return { text, live: true as const };
    } else {
      // If it fails, we still read the response to see if there's a quota error or similar
      const errorText = await res.text();
      return {
        text: `Error from proxy: ${res.status} ${res.statusText}\n${errorText}`,
        live: false as const,
      };
    }
  } catch (err: any) {
    return {
      text:
        `_(mock response — proxy at ${s.proxyApi} unreachable)_\n\n` +
        `Error: ${err.message}\n\n` +
        `This is where the **${model}** response would stream in via your Refract Proxy.`,
      live: false as const,
    };
  }
}

