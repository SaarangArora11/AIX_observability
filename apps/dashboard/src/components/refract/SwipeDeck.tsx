import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { useState } from "react";
import type { Trace } from "@/lib/refract/types";
import { cn } from "@/lib/utils";

const formatLatency = (ms: number) => (ms > 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`);

export function SwipeDeck({
  traces,
  onPick,
  onDismiss,
}: {
  traces: Trace[];
  onPick: (t: Trace) => void;
  onDismiss?: (t: Trace) => void;
}) {
  const [index, setIndex] = useState(0);
  const visible = traces.slice(index, index + 4);

  const handleDragEnd = (t: Trace, _: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 120 || Math.abs(info.velocity.x) > 600) {
      onDismiss?.(t);
      setIndex((i) => Math.min(i + 1, traces.length));
    }
  };

  return (
    <div className="relative h-[460px] flex items-center justify-center">
      <AnimatePresence>
        {visible.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card grain spotlight p-10 text-center"
          >
            <div className="font-display text-2xl mb-2">Deck cleared</div>
            <p className="text-sm text-muted-foreground">All traces reviewed.</p>
            <button
              onClick={() => setIndex(0)}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Reshuffle
            </button>
          </motion.div>
        )}
        {visible.map((t, i) => {
          const depth = i;
          return (
            <motion.div
              key={t.id}
              className={cn("absolute w-[min(90%,420px)]")}
              style={{ zIndex: 10 - i }}
              initial={{ scale: 0.9, y: 40, opacity: 0 }}
              animate={{
                scale: 1 - depth * 0.04,
                y: depth * 14,
                opacity: 1 - depth * 0.18,
              }}
              exit={{ x: 400, opacity: 0, rotate: 12, transition: { duration: 0.35 } }}
              drag={depth === 0 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              whileDrag={{ rotate: 4, cursor: "grabbing" }}
              onDragEnd={(e, info) => handleDragEnd(t, e, info)}
              onClick={() => depth === 0 && onPick(t)}
            >
              <div className="glass-card grain spotlight p-6 cursor-grab active:cursor-grabbing">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        t.status === "success"
                          ? "bg-emerald-400"
                          : t.status === "error"
                            ? "bg-destructive"
                            : "bg-amber-400",
                      )}
                    />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {t.source}
                    </span>
                  </div>
                  <span className="font-mono-tight text-[10px] text-muted-foreground">
                    {t.id.slice(0, 14)}
                  </span>
                </div>
                <div className="font-display text-xl mb-1">{t.model}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
                  {t.provider}
                </div>
                <p className="text-sm text-foreground/80 line-clamp-3 mb-5 min-h-[60px]">
                  {t.prompt}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="latency" value={formatLatency(t.latencyMs)} />
                  <Stat label="tokens" value={(t.inputTokens + t.outputTokens).toLocaleString()} />
                  <Stat label="cost" value={`$${t.costUsd.toFixed(4)}`} />
                </div>
                {depth === 0 && (
                  <div className="mt-5 text-center text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    ← swipe · tap to inspect →
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 py-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono-tight text-sm mt-0.5">{value}</div>
    </div>
  );
}
