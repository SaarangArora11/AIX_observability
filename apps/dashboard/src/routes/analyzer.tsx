import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { analyzeTrace, fetchTraces } from "@/lib/refract/client";
import { GlassCard } from "@/components/refract/GlassCard";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import type { AnalysisResult, Trace } from "@/lib/refract/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analyzer")({
  head: () => ({
    meta: [
      { title: "Prompt Analyzer · Refract" },
      { name: "description", content: "Categorize prompts, score complexity, and identify model-cascading cost savings." }
    ],
  }),
  component: AnalyzerPage,
});

function AnalyzerPage() {
  const { data } = useQuery({ queryKey: ["traces", 50], queryFn: () => fetchTraces(50) });
  const [selected, setSelected] = useState<Trace | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isMock, setIsMock] = useState(false);

  const run = useMutation({
    mutationFn: analyzeTrace,
    onSuccess: ({ data, live }) => { setResult(data); setIsMock(!live || !!data.mock); },
  });

  const pick = (t: Trace) => { setSelected(t); setResult(null); };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Prompt Analyzer</div>
        <h1 className="font-display text-4xl">Right-size every <span className="prism-text">model call</span>.</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <GlassCard className="lg:col-span-2 p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">pick a trace</div>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {data?.data.map((t) => (
              <button
                key={t.id}
                onClick={() => pick(t)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selected?.id === t.id ? "bg-primary/10 border-primary/30" : "border-white/5 hover:bg-white/[0.04]"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono-tight text-[10px] text-muted-foreground">{t.id.slice(0, 14)}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.model}</span>
                </div>
                <div className="text-sm line-clamp-2 text-foreground/80">{t.prompt}</div>
              </button>
            ))}
          </div>
        </GlassCard>

        <div className="lg:col-span-3 space-y-4">
          <GlassCard className="p-6 min-h-[200px]">
            {!selected ? (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <Sparkles className="size-8 text-muted-foreground mb-3" />
                <div className="font-display text-xl">Select a trace to analyze</div>
                <p className="text-sm text-muted-foreground mt-1">The analyzer rates complexity, categorizes the task, and flags cascading savings.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">target</div>
                    <div className="font-display text-xl mt-1">{selected.model}</div>
                    <div className="font-mono-tight text-xs text-muted-foreground">{selected.id}</div>
                  </div>
                  <Button
                    onClick={() => run.mutate(selected.id)}
                    disabled={run.isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Sparkles className="size-4 mr-1" />
                    {run.isPending ? "Analyzing…" : "Analyze"}
                  </Button>
                </div>
                <pre className="text-xs font-mono-tight text-foreground/80 whitespace-pre-wrap bg-background/30 border border-white/5 p-3 rounded-lg max-h-32 overflow-y-auto">
                  {selected.prompt}
                </pre>
              </>
            )}
          </GlassCard>

          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key={result.traceId + result.category}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                {isMock && (
                  <div className="text-[10px] uppercase tracking-widest text-amber-300 bg-amber-400/5 border border-amber-400/20 rounded-md px-3 py-1.5">
                    fallback analysis · gemini quota or proxy unreachable
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05 }}>
                    <GlassCard className="p-5">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">category</div>
                      <div className="font-display text-2xl mt-2 capitalize">{result.category.replace("-", " ")}</div>
                    </GlassCard>
                  </motion.div>
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 }}>
                    <GlassCard className="p-5">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">complexity</div>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="font-display text-2xl">{Math.round(result.complexity * 100)}</span>
                        <span className="text-xs text-muted-foreground pb-1.5">/ 100</span>
                      </div>
                      <div className="h-1.5 mt-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result.complexity * 100}%` }}
                          transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full"
                          style={{ background: "var(--gradient-ember)" }}
                        />
                      </div>
                    </GlassCard>
                  </motion.div>
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.25 }}>
                    <GlassCard className={cn(
                      "p-5",
                      result.modelFit === "overkill" && "ring-1 ring-primary/40"
                    )}>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">model fit</div>
                      <div className={cn(
                        "font-display text-2xl mt-2 capitalize",
                        result.modelFit === "overkill" && "prism-text",
                        result.modelFit === "underkill" && "text-destructive"
                      )}>{result.modelFit.replace("_", " ")}</div>
                    </GlassCard>
                  </motion.div>
                </div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <GlassCard className="p-6">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">recommendation</div>
                    <p className="text-sm text-foreground/85 leading-relaxed mb-4">{result.rationale}</p>
                    {result.estimatedSavingsUsd > 0 && (
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex-1">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">cascade to</div>
                          <div className="flex items-center gap-2 mt-1 font-mono-tight text-sm">
                            <span className="text-muted-foreground line-through">{selected?.model}</span>
                            <ArrowRight className="size-3" />
                            <span className="text-primary">{result.suggestedModel}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">est. savings / call</div>
                          <div className="font-display text-2xl prism-text">${result.estimatedSavingsUsd.toFixed(5)}</div>
                        </div>
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
