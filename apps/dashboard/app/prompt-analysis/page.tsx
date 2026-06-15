'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Microscope,
  Zap,
  TrendingDown,
  Target,
  DollarSign,
  BarChart3,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from 'recharts';
import {
  getRefractKPIs,
  getTraces,
  analyzePrompt,
  batchAnalyzePrompts,
  type RefractKPIsResponse,
  type Trace,
} from '@/lib/api';

// Color palettes
const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#06b6d4', '#3b82f6', '#0ea5e9', '#14b8a6',
  '#f59e0b', '#ef4444',
];

const FIT_COLORS: Record<string, string> = {
  good_fit: '#22c55e',
  overkill: '#f59e0b',
  underkill: '#ef4444',
};

const FIT_LABELS: Record<string, string> = {
  good_fit: 'Good Fit',
  overkill: 'Overkill',
  underkill: 'Underkill',
};

export default function PromptAnalysisPage() {
  const [kpis, setKpis] = useState<RefractKPIsResponse | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [analyzingTraceId, setAnalyzingTraceId] = useState<string | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [kpiData, tracesData] = await Promise.all([
        getRefractKPIs().catch(() => null),
        getTraces({ limit: 20 }).catch(() => ({ data: [] })),
      ]);
      if (kpiData) setKpis(kpiData);
      setTraces(tracesData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAnalyze(traceId: string, spanId: string) {
    setAnalyzingTraceId(traceId);
    try {
      await analyzePrompt(traceId, spanId);
      await loadData(); // Refresh
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzingTraceId(null);
    }
  }

  async function handleBatchAnalyze() {
    setBatchAnalyzing(true);
    setBatchResult(null);
    try {
      const result = await batchAnalyzePrompts(15);
      setBatchResult(`Analyzed ${result.analyzed} traces successfully`);
      await loadData();
    } catch (error) {
      setBatchResult('Batch analysis failed — check API connection');
      console.error('Batch analysis error:', error);
    } finally {
      setBatchAnalyzing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categoryData = kpis?.categories?.map((c, i) => ({
    name: (c.category || 'unknown').replace(/_/g, ' '),
    value: c.count,
    cost: c.total_cost,
    fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  })) || [];

  const fitData = kpis?.model_fit?.map((m) => ({
    name: FIT_LABELS[m.fit] || m.fit,
    value: m.count,
    cost: m.total_cost,
    fill: FIT_COLORS[m.fit] || '#6b7280',
  })) || [];

  const modelData = kpis?.model_breakdown?.map((m) => ({
    name: m.model.replace('gemini-', 'g-').replace('gpt-', ''),
    requests: m.count,
    cost: m.total_cost,
    latency: m.avg_latency,
    tokens: m.total_tokens,
  })) || [];

  const sourceData = kpis?.sources?.map((s) => ({
    name: (s.source || 'sdk').toUpperCase(),
    value: s.count,
    cost: s.total_cost,
  })) || [];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Microscope className="h-6 w-6 text-primary" />
            Prompt Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered prompt categorization, model-fit scoring, and cost optimization insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          {batchResult && (
            <Badge variant="outline" className="text-xs">
              {batchResult}
            </Badge>
          )}
          <Button
            onClick={handleBatchAnalyze}
            disabled={batchAnalyzing}
            className="gap-2"
          >
            {batchAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {batchAnalyzing ? 'Analyzing...' : 'Auto-Analyze Traces'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard
          label="Prompt Efficiency"
          value={`${((kpis?.kpis?.avg_prompt_efficiency || 0) * 100).toFixed(0)}%`}
          icon={<Zap className="h-4 w-4" />}
          color="text-blue-400"
          subtitle="Output / Input ratio"
        />
        <KPICard
          label="Model Alignment"
          value={`${(kpis?.kpis?.model_alignment_score || 0).toFixed(0)}%`}
          icon={<Target className="h-4 w-4" />}
          color="text-green-400"
          subtitle="Right-sized model usage"
        />
        <KPICard
          label="Overkill Rate"
          value={`${(kpis?.kpis?.overkill_percentage || 0).toFixed(0)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
          color="text-amber-400"
          subtitle="Using overpriced models"
        />
        <KPICard
          label="Est. Savings"
          value={`$${(kpis?.kpis?.estimated_savings || 0).toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4" />}
          color="text-emerald-400"
          subtitle="From model cascading"
        />
        <KPICard
          label="Traces Analyzed"
          value={`${kpis?.kpis?.total_analyzed || 0}`}
          icon={<BarChart3 className="h-4 w-4" />}
          color="text-purple-400"
          subtitle="With prompt analysis"
        />
        <KPICard
          label="Token Flow"
          value={`${((kpis?.token_flow?.total_prompt_tokens || 0) / 1000).toFixed(1)}K`}
          icon={<ArrowDown className="h-4 w-4" />}
          color="text-cyan-400"
          subtitle={`→ ${((kpis?.token_flow?.total_completion_tokens || 0) / 1000).toFixed(1)}K out`}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Prompt Category Distribution */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Prompt Categories
          </h3>
          {categoryData.length > 0 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => [value, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="Run analysis to see categories" />
          )}
          <div className="mt-3 space-y-1.5">
            {categoryData.slice(0, 5).map((cat, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: cat.fill }} />
                  <span className="capitalize text-muted-foreground">{cat.name}</span>
                </div>
                <span className="font-mono font-medium">{cat.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Model Fit Distribution */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Model-Task Alignment
          </h3>
          {fitData.length > 0 ? (
            <>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fitData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {fitData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1.5">
                {fitData.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: f.fill }} />
                      <span className="text-muted-foreground">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{f.value}</span>
                      <span className="text-muted-foreground">
                        (${f.cost.toFixed(4)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState message="Run analysis to see model fit data" />
          )}
        </Card>

        {/* Model Cost Breakdown */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Cost by Model
          </h3>
          {modelData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'cost') return [`$${value.toFixed(6)}`, 'Cost'];
                      if (name === 'latency') return [`${value.toFixed(0)}ms`, 'Avg Latency'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="requests" fill="#6366f1" radius={[0, 4, 4, 0]} name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No model data yet" />
          )}
        </Card>
      </div>

      {/* Source Distribution + Token Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-500" />
            Source Distribution
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {sourceData.map((s, i) => (
              <div key={i} className="rounded-lg border border-border p-4 text-center">
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.name} traces</div>
                <div className="text-xs font-mono text-green-400 mt-1">
                  ${s.cost.toFixed(4)}
                </div>
              </div>
            ))}
            {sourceData.length === 0 && (
              <div className="col-span-2">
                <EmptyState message="No source data" />
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            Token Flow Breakdown
          </h3>
          <div className="space-y-4">
            <TokenBar
              label="Prompt Tokens (Input)"
              value={kpis?.token_flow?.total_prompt_tokens || 0}
              total={(kpis?.token_flow?.total_tokens || 1)}
              color="bg-blue-500"
            />
            <TokenBar
              label="Completion Tokens (Output)"
              value={kpis?.token_flow?.total_completion_tokens || 0}
              total={(kpis?.token_flow?.total_tokens || 1)}
              color="bg-purple-500"
            />
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Tokens</span>
                <span className="font-mono font-medium">
                  {(kpis?.token_flow?.total_tokens || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Traces Table */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          Recent Traces
          <Badge variant="outline" className="text-xs">
            {traces.length} loaded
          </Badge>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 text-left font-medium">Prompt Preview</th>
                <th className="pb-2 text-left font-medium">Model</th>
                <th className="pb-2 text-left font-medium">Latency</th>
                <th className="pb-2 text-left font-medium">Cost</th>
                <th className="pb-2 text-left font-medium">Tokens</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {traces.slice(0, 15).map((trace) => (
                <tr key={`${trace.trace_id}-${trace.span_id}`} className="hover:bg-muted/30">
                  <td className="py-2.5 max-w-[300px]">
                    <div className="truncate text-foreground">
                      {trace.prompt?.substring(0, 80) || '—'}
                      {(trace.prompt?.length || 0) > 80 ? '...' : ''}
                    </div>
                  </td>
                  <td className="py-2.5">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {trace.model}
                    </Badge>
                  </td>
                  <td className="py-2.5 font-mono text-amber-400">
                    {trace.latency_ms?.toFixed(0)}ms
                  </td>
                  <td className="py-2.5 font-mono text-green-400">
                    ${(trace.cost_usd || 0).toFixed(6)}
                  </td>
                  <td className="py-2.5 font-mono">
                    {trace.prompt_tokens || 0}→{trace.completion_tokens || 0}
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] gap-1"
                      onClick={() => handleAnalyze(trace.trace_id, trace.span_id)}
                      disabled={analyzingTraceId === trace.trace_id}
                    >
                      {analyzingTraceId === trace.trace_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Microscope className="h-3 w-3" />
                      )}
                      Analyze
                    </Button>
                  </td>
                </tr>
              ))}
              {traces.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No traces found. Send messages through the Demo Chat to generate traces.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function KPICard({
  label,
  value,
  icon,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  subtitle: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={color}>{icon}</div>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-xl font-bold font-mono">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{subtitle}</div>
    </Card>
  );
}

function TokenBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {percentage.toFixed(1)}% of total
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
      <div className="text-center">
        <Microscope className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>{message}</p>
      </div>
    </div>
  );
}
