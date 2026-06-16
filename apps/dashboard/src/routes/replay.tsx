import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchTraces, fetchTrace, chatCompletion, analyzeTrace } from "@/lib/refract/client";
import { GlassCard } from "@/components/refract/GlassCard";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Send, Loader2 } from "lucide-react";
import type { Trace } from "@/lib/refract/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/replay")({
  head: () => ({
    meta: [
      { title: "Replay · Refract" },
      { name: "description", content: "Replay captured LLM traces and generate new ones via the built-in proxy chat." }
    ],
  }),
  component: ReplayPage,
});

const MODELS = ["gemini-2.0-flash", "gemini-2.5-pro", "gpt-4o-mini", "claude-3-haiku"];

function ReplayPage() {
  const { data } = useQuery({ queryKey: ["traces", 20], queryFn: () => fetchTraces(20) });
  const [selected, setSelected] = useState<Trace | null>(null);

  const { data: fullTrace } = useQuery({
    queryKey: ["trace", selected?.id],
    queryFn: () => fetchTrace(selected!.id),
    enabled: !!selected
  });

  const displayTrace = fullTrace?.data || selected;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Replay & Chat</div>
        <h1 className="font-display text-4xl">Rewind any prompt. Generate new ones.</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <GlassCard className="lg:col-span-2 p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">recent captures</div>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
            {data?.data.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selected?.id === t.id ? "bg-primary/10 border-primary/30" : "border-white/5 hover:bg-white/[0.04]"
                )}
              >
                <div className="font-mono-tight text-[10px] text-muted-foreground">{t.id.slice(0, 14)} · {t.model}</div>
                <div className="text-sm line-clamp-2 mt-0.5">{t.prompt || "No prompt snippet available"}</div>
              </button>
            ))}
          </div>
        </GlassCard>

        <div className="lg:col-span-3">
          <ReplayPlayer trace={displayTrace} />
        </div>
      </div>

      <Chat />
    </div>
  );
}

function ReplayPlayer({ trace }: { trace: Trace | null }) {
  const [playing, setPlaying] = useState(false);
  const [chars, setChars] = useState(0);

  const { data: analysis } = useQuery({
    queryKey: ["analysis", trace?.id],
    queryFn: () => analyzeTrace(trace!.id),
    enabled: !!trace
  });

  useEffect(() => { setChars(0); setPlaying(false); }, [trace?.id]);

  useEffect(() => {
    if (!playing || !trace) return;
    const id = setInterval(() => {
      setChars((c) => {
        if (!trace) return c;
        if (c >= trace.completion.length) { setPlaying(false); return c; }
        return c + 2;
      });
    }, 18);
    return () => clearInterval(id);
  }, [playing, trace]);

  if (!trace) {
    return (
      <GlassCard className="p-10 text-center h-full flex flex-col items-center justify-center min-h-[300px]">
        <div className="font-display text-xl text-muted-foreground">Select a trace to replay</div>
      </GlassCard>
    );
  }

  const pct = (chars / trace.completion.length) * 100;

  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">replaying</div>
          <div className="font-display text-xl">{trace.model}</div>
          <div className="font-mono-tight text-[10px] text-muted-foreground">{trace.id}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => { setChars(0); setPlaying(true); }}>
            <RotateCcw className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setPlaying((p) => !p)} className="bg-primary/20 hover:bg-primary/30">
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">prompt</div>
        <PromptRenderer promptText={trace.prompt} />
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
          <span>completion stream</span>
          <span className="font-mono-tight">{chars}/{trace.completion.length}</span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-3">
          <div className="h-full transition-[width] duration-100" style={{ width: `${pct}%`, background: "var(--gradient-ember)" }} />
        </div>
        <pre className="text-sm font-mono-tight whitespace-pre-wrap min-h-[120px] bg-background/40 border border-white/5 p-4 rounded-lg">
          {trace.completion.slice(0, chars)}
          {playing && <span className="inline-block w-1.5 h-4 align-middle bg-primary ml-0.5 animate-pulse" />}
        </pre>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Stat label="latency" value={`${trace.latencyMs}ms`} />
        <Stat label="tokens" value={`${trace.inputTokens}→${trace.outputTokens}`} />
        <Stat label="cost" value={`$${trace.costUsd.toFixed(4)}`} />
      </div>

      {analysis?.data && (
        <div className="mt-6 pt-6 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">prompt analysis & improvements</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4">
              <div className="text-xs font-medium mb-1">Model Fit</div>
              <div className="text-sm text-muted-foreground mb-3">{analysis.data.rationale}</div>
              {analysis.data.modelFit !== "good_fit" && (
                <div className="text-xs text-primary bg-primary/10 inline-flex items-center px-2 py-1 rounded">
                  Suggested: {analysis.data.suggestedModel}
                </div>
              )}
            </div>
            
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4">
              <div className="text-xs font-medium mb-2">Suggested Improvements</div>
              <ul className="space-y-2">
                {analysis.data.improvements?.map((imp, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function PromptRenderer({ promptText }: { promptText: string }) {
  if (!promptText) return null;
  
  if (!promptText.includes("[user]") && !promptText.includes("[assistant]")) {
    return <pre className="text-xs font-mono-tight text-foreground/70 whitespace-pre-wrap bg-background/30 border border-white/5 p-3 rounded-lg">{promptText}</pre>;
  }

  const blocks = promptText.split(/\[(user|assistant)\]\n/g).filter(Boolean);
  const messages = [];
  for (let i = 0; i < blocks.length; i += 2) {
    const role = blocks[i];
    const text = blocks[i+1];
    if (role && text) messages.push({ role, text: text.trim() });
  }

  return (
    <div className="space-y-3 bg-background/30 border border-white/5 p-4 rounded-lg">
      {messages.map((m, i) => (
        <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
          <div className={cn(
            "max-w-[85%] rounded-lg p-3 text-xs font-mono-tight whitespace-pre-wrap",
            m.role === "user" 
              ? "bg-primary/20 border border-primary/30 text-primary-foreground" 
              : "bg-white/[0.04] border border-white/5 text-foreground/80"
          )}>
            <div className="text-[9px] uppercase tracking-widest opacity-50 mb-1">{m.role}</div>
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] border border-white/5 p-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono-tight text-xs mt-1">{value}</div>
    </div>
  );
}

interface Msg { role: "user" | "assistant"; content: string; mock?: boolean }

function Chat() {
  const [model, setModel] = useState(MODELS[0]);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi — I route through your Refract Proxy. Anything you ask here generates a real trace. Try me." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const newMsgs = [...messages, { role: "user" as const, content: text }];
    setMessages(newMsgs);
    setInput("");
    setSending(true);
    const res = await chatCompletion(model, newMsgs.map((m) => ({ role: m.role, content: m.content })));
    setMessages((m) => [...m, { role: "assistant", content: res.text, mock: !res.live }]);
    setSending(false);
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">chat</div>
          <div className="font-display text-2xl">Generate a trace</div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {MODELS.map((m) => (
            <button
              key={m}
              onClick={() => setModel(m)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-mono-tight uppercase tracking-wider transition-colors",
                model === m ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >{m}</button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[360px] overflow-y-auto space-y-3 pr-2 mb-4">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-white/[0.05] border border-white/10 rounded-bl-sm"
                )}
              >
                {m.content}
                {m.mock && <div className="text-[10px] mt-1 opacity-60">— mock</div>}
              </div>
            </motion.div>
          ))}
          {sending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex">
              <div className="bg-white/[0.05] border border-white/10 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Routing through proxy…
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`Message ${model}…`}
          className="flex-1 bg-background/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/40 transition-colors"
        />
        <Button onClick={send} disabled={sending || !input.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
          <Send className="size-4" />
        </Button>
      </div>
    </GlassCard>
  );
}
