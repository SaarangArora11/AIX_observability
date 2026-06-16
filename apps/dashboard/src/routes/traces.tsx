import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTraces, deleteTrace } from "@/lib/refract/client";
import { GlassCard } from "@/components/refract/GlassCard";
import { SwipeDeck } from "@/components/refract/SwipeDeck";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useState, useMemo } from "react";
import { Search, X, Trash2, Filter } from "lucide-react";
import type { Trace } from "@/lib/refract/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/traces")({
  head: () => ({
    meta: [
      { title: "Traces · Refract" },
      {
        name: "description",
        content:
          "Inspect, swipe through, and analyze every LLM trace captured by the Refract Proxy.",
      },
    ],
  }),
  component: TracesPage,
});

function TracesPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["traces", 50], queryFn: () => fetchTraces(50) });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "error" | "proxy" | "sdk">("all");
  const [selected, setSelected] = useState<Trace | null>(null);

  const del = useMutation({
    mutationFn: deleteTrace,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traces"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      toast.success("Trace deleted");
      setSelected(null);
    },
  });

  const traces = useMemo(() => {
    let t = data?.data ?? [];
    if (filter === "error") t = t.filter((x) => x.status === "error");
    if (filter === "proxy") t = t.filter((x) => x.source === "proxy");
    if (filter === "sdk") t = t.filter((x) => x.source === "sdk");
    if (q.trim()) {
      const Q = q.toLowerCase();
      t = t.filter(
        (x) =>
          x.model.includes(Q) ||
          x.id.toLowerCase().includes(Q) ||
          x.prompt.toLowerCase().includes(Q),
      );
    }
    return t;
  }, [data, q, filter]);

  return (
    <LayoutGroup>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Traces
          </div>
          <h1 className="font-display text-4xl">Every prompt, captured.</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* List */}
          <GlassCard className="lg:col-span-3 p-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="search by model, id, prompt…"
                  className="pl-9 bg-background/40 border-white/10"
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Filter className="size-3 text-muted-foreground mr-1" />
                {(["all", "proxy", "sdk", "error"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-2.5 py-1 rounded-md uppercase tracking-wider text-[10px] transition-colors",
                      filter === f
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-white/5">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-white/[0.03]">
                  <tr>
                    <th className="text-left px-3 py-2 font-normal">id</th>
                    <th className="text-left px-3 py-2 font-normal">model</th>
                    <th className="text-right px-3 py-2 font-normal">latency</th>
                    <th className="text-right px-3 py-2 font-normal">tokens</th>
                    <th className="text-right px-3 py-2 font-normal">cost</th>
                  </tr>
                </thead>
                <tbody>
                  {traces.map((t) => (
                    <motion.tr
                      key={t.id}
                      layoutId={`row-${t.id}`}
                      onClick={() => setSelected(t)}
                      className={cn(
                        "border-t border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors",
                        selected?.id === t.id && "bg-primary/10",
                      )}
                    >
                      <td className="px-3 py-2.5 font-mono-tight text-xs">
                        <span
                          className={cn(
                            "inline-block size-1.5 rounded-full mr-2",
                            t.status === "success" ? "bg-emerald-400" : "bg-destructive",
                          )}
                        />
                        {t.id.slice(0, 14)}
                      </td>
                      <td className="px-3 py-2.5">{t.model}</td>
                      <td className="px-3 py-2.5 text-right font-mono-tight text-xs">
                        {t.latencyMs}ms
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-tight text-xs">
                        {(t.inputTokens + t.outputTokens).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-tight text-xs">
                        ${t.costUsd.toFixed(4)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {traces.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No traces match.
                </div>
              )}
            </div>
          </GlassCard>

          {/* Right pane */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.id}
                  layoutId={`row-${selected.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <GlassCard className="p-6">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          trace
                        </div>
                        <div className="font-mono-tight text-xs mt-1">{selected.id}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => del.mutate(selected.id)}
                          className="hover:bg-destructive/20 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="font-display text-2xl mb-1">{selected.model}</div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
                      {selected.provider} · {selected.source} · {selected.category}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-5">
                      <Mini label="latency" value={`${selected.latencyMs}ms`} />
                      <Mini label="cost" value={`$${selected.costUsd.toFixed(4)}`} />
                      <Mini label="fit" value={selected.modelFit ?? "—"} />
                    </div>

                    <Section title="Prompt">
                      <pre className="whitespace-pre-wrap text-xs font-mono-tight text-foreground/80 leading-relaxed">
                        {selected.prompt}
                      </pre>
                    </Section>
                    <Section title="Completion">
                      <pre className="whitespace-pre-wrap text-xs font-mono-tight text-foreground/80 leading-relaxed">
                        {selected.completion}
                      </pre>
                    </Section>
                    <Section title="Spans">
                      <div className="space-y-1.5">
                        {selected.spans?.map((s, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <span className="font-mono-tight text-muted-foreground w-32 truncate">
                              {s.name}
                            </span>
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full"
                                style={{
                                  marginLeft: `${(s.startMs / selected.latencyMs) * 100}%`,
                                  width: `${Math.max(2, (s.durationMs / selected.latencyMs) * 100)}%`,
                                  background:
                                    s.kind === "llm" ? "var(--ember)" : "var(--prism-cyan)",
                                }}
                              />
                            </div>
                            <span className="font-mono-tight text-muted-foreground w-12 text-right">
                              {s.durationMs}ms
                            </span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  </GlassCard>
                </motion.div>
              ) : (
                <motion.div
                  key="deck"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 text-center">
                    swipe deck
                  </div>
                  <SwipeDeck traces={traces} onPick={setSelected} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </LayoutGroup>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] border border-white/5 p-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono-tight text-xs mt-1 capitalize">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
        {title}
      </div>
      <div className="rounded-lg bg-background/30 border border-white/5 p-3 max-h-40 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
