import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMetrics, fetchTraces } from "@/lib/refract/client";
import { GlassCard } from "@/components/refract/GlassCard";
import { MagneticTile } from "@/components/refract/MagneticTile";
import { CountUp } from "@/components/refract/CountUp";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Zap, DollarSign, Gauge, Activity, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · Refract" },
      {
        name: "description",
        content: "Real-time AI telemetry, prompt efficiency, and cost-optimization metrics.",
      },
    ],
  }),
  component: OverviewPage,
});

const fmtMoney = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

function OverviewPage() {
  const { data: metrics } = useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
    refetchInterval: 15000,
  });
  const { data: tracesQ } = useQuery({ queryKey: ["traces", 8], queryFn: () => fetchTraces(8) });

  const m = metrics?.data;
  const live = metrics?.live;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Dashboard
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border ${live ? "border-emerald-400/30 text-emerald-300 bg-emerald-400/5" : "border-amber-400/30 text-amber-300 bg-amber-400/5"}`}
          >
            {live ? "live" : "mock data · configure endpoints"}
          </span>
        </div>
        <h1 className="font-display text-5xl md:text-6xl leading-[0.95]">
          Transparent <span className="prism-text">telemetry</span>
          <br />
          for every prompt.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          Refract observes every LLM call through your proxy or SDK and surfaces what each token
          actually costs you.
        </p>
      </motion.div>

      {m && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiTile icon={Gauge} label="Efficiency" hint="output/input">
              <CountUp value={m.efficiencyScore} decimals={2} />
            </KpiTile>
            <KpiTile icon={DollarSign} label="Savings" hint="vs picked models" accent>
              <CountUp value={m.estimatedSavingsUsd} decimals={4} prefix="$" />
            </KpiTile>
            <KpiTile icon={Zap} label="Avg latency" hint="proxy + LLM">
              <CountUp value={m.avgLatencyMs} suffix="ms" />
            </KpiTile>
            <KpiTile icon={TrendingUp} label="Tokens" hint="total">
              <CountUp value={m.totalTokens} />
            </KpiTile>
            <KpiTile icon={Activity} label="Traces" hint="captured">
              <CountUp value={m.totalTraces} />
            </KpiTile>
            <KpiTile icon={AlertTriangle} label="Errors" hint="rate">
              <CountUp value={m.errorRate * 100} decimals={1} suffix="%" />
            </KpiTile>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GlassCard className="lg:col-span-2 p-6">
              <SectionTitle eyebrow="Token flow" title="Input vs output, last 24 buckets" />
              <div className="h-64 mt-4">
                <ResponsiveContainer>
                  <BarChart data={m.tokenFlow} stackOffset="sign">
                    <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.06)" />
                    <XAxis
                      dataKey="time"
                      stroke="oklch(1 0 0 / 0.4)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="oklch(1 0 0 / 0.4)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                      contentStyle={{
                        background: "oklch(0.15 0.008 35 / 0.95)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                        borderRadius: 12,
                        backdropFilter: "blur(12px)",
                      }}
                    />
                    <Bar dataKey="input" stackId="a" fill="var(--ember)" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="output" stackId="a" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <SectionTitle eyebrow="Model-task fit" title="Where you're over-spending" />
              <div className="h-48 mt-2">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Overkill", value: m.modelFit.overkill, fill: "var(--ember)" },
                        { name: "Good fit", value: m.modelFit.good_fit, fill: "var(--gold)" },
                        {
                          name: "Underkill",
                          value: m.modelFit.underkill,
                          fill: "var(--prism-cyan)",
                        },
                      ]}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {[0, 1, 2].map((i) => (
                        <Cell key={i} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.15 0.008 35 / 0.95)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                        borderRadius: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                <Legend dot="var(--ember)" label="Overkill" value={m.modelFit.overkill} />
                <Legend dot="var(--gold)" label="Good fit" value={m.modelFit.good_fit} />
                <Legend dot="var(--prism-cyan)" label="Underkill" value={m.modelFit.underkill} />
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GlassCard className="p-6">
              <SectionTitle eyebrow="Providers" title="Traffic mix" />
              <div className="mt-4 space-y-3">
                {m.providerMix.map((p) => {
                  const pct = (p.count / m.totalTraces) * 100;
                  return (
                    <div key={p.provider}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="capitalize">{p.provider}</span>
                        <span className="font-mono-tight text-muted-foreground">
                          {p.count} · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full"
                          style={{ background: "var(--gradient-ember)" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard className="lg:col-span-2 p-6">
              <SectionTitle eyebrow="Live feed" title="Recent traces" />
              <div className="mt-4 space-y-1.5 max-h-64 overflow-y-auto pr-2">
                {tracesQ?.data.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`size-1.5 rounded-full ${t.status === "success" ? "bg-emerald-400" : "bg-destructive"}`}
                      />
                      <span className="font-mono-tight text-[10px] text-muted-foreground">
                        {t.id.slice(0, 12)}
                      </span>
                      <span className="text-sm truncate">{t.prompt}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs font-mono-tight text-muted-foreground">
                      <span>{t.model}</span>
                      <span className="text-foreground/70">{fmtMoney(t.costUsd)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  hint,
  children,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <MagneticTile>
      <GlassCard className="p-4 h-full">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <Icon className={`size-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className={`mt-3 font-display text-3xl ${accent ? "prism-text" : ""}`}>{children}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>
      </GlassCard>
    </MagneticTile>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{eyebrow}</div>
      <div className="font-display text-xl mt-1">{title}</div>
    </div>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
        <span className="size-1.5 rounded-full" style={{ background: dot }} />
        {label}
      </div>
      <div className="font-mono-tight mt-0.5">{value}</div>
    </div>
  );
}
