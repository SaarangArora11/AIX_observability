import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  type ApiSettings,
} from "@/lib/refract/settings";
import { pingService } from "@/lib/refract/client";

export function SettingsDrawer() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<ApiSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<Record<string, "idle" | "checking" | "ok" | "fail">>({});

  useEffect(() => {
    if (open) setS(loadSettings());
  }, [open]);

  const test = async (key: keyof ApiSettings) => {
    setStatus((x) => ({ ...x, [key]: "checking" }));
    const ok = await pingService(s[key]);
    setStatus((x) => ({ ...x, [key]: ok ? "ok" : "fail" }));
  };

  const save = () => {
    saveSettings(s);
    setOpen(false);
  };

  const fields: { key: keyof ApiSettings; label: string; hint: string }[] = [
    { key: "queryApi", label: "Query API", hint: "Traces, metrics, analyze (default :8081)" },
    { key: "replayApi", label: "Replay Engine", hint: "Trace replay (default :8082)" },
    { key: "proxyApi", label: "Proxy Gateway", hint: "LLM proxy + chat (default :8090)" },
  ];

  const Icon = ({ k }: { k: string }) => {
    const st = status[k];
    if (st === "checking") return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
    if (st === "ok") return <CheckCircle2 className="size-4 text-emerald-400" />;
    if (st === "fail") return <XCircle className="size-4 text-destructive" />;
    return null;
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5">
          <Settings2 className="size-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="ml-auto h-full w-full max-w-md bg-card/80 backdrop-blur-2xl border-l border-white/10">
        <DrawerHeader>
          <DrawerTitle className="font-display text-2xl">API endpoints</DrawerTitle>
          <DrawerDescription>
            Point the dashboard at your Refract services. Preview can't reach{" "}
            <code className="font-mono-tight text-xs">localhost</code> directly — run the app
            locally or use a tunnel URL.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 space-y-5">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{f.label}</Label>
                <Icon k={f.key} />
              </div>
              <Input
                value={s[f.key]}
                onChange={(e) => setS({ ...s, [f.key]: e.target.value })}
                className="font-mono-tight text-xs bg-background/40"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{f.hint}</p>
                <button
                  onClick={() => test(f.key)}
                  className="text-xs text-primary hover:underline"
                >
                  test
                </button>
              </div>
            </div>
          ))}
        </div>
        <DrawerFooter>
          <Button onClick={save} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Save
          </Button>
          <Button variant="ghost" onClick={() => setS(DEFAULT_SETTINGS)}>
            Reset to defaults
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
