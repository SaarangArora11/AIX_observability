import { Link } from "@tanstack/react-router";
import { Activity, ListTree, Sparkles, PlayCircle, Search, Bell } from "lucide-react";
import { SettingsDrawer } from "./SettingsDrawer";
import { Toaster } from "@/components/ui/sonner";

const nav = [
  { to: "/", label: "Overview", icon: Activity },
  { to: "/traces", label: "Traces", icon: ListTree },
  { to: "/analyzer", label: "Analyzer", icon: Sparkles },
  { to: "/replay", label: "Replay", icon: PlayCircle },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside
        className="hidden md:flex flex-col w-[220px] shrink-0 sticky top-0 h-screen border-r border-white/[0.04]"
        style={{ background: "#0A0A0F" }}
      >
        {/* Wordmark */}
        <div className="px-5 py-6 flex items-center gap-2.5">
          <div
            className="size-7 rounded-lg shadow-[0_0_20px_rgba(255,0,110,0.4)]"
            style={{
              background: "linear-gradient(135deg, #FF006E, #8338EC, #3A86FF)",
              backgroundSize: "200% 200%",
              animation: "gradient-shift 5s ease infinite",
            }}
          />
          <div className="font-display text-base font-bold prism-text leading-none">refract</div>
        </div>

        {/* Eyebrow */}
        <div className="px-5 mt-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-[#4B5563]">
          Workspace
        </div>

        <nav className="px-3 mt-2 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[#9CA3AF] hover:text-foreground hover:bg-white/[0.03] hover:translate-x-[2px] transition-all duration-150 data-[status=active]:text-foreground"
              style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            >
              {/* Active gradient strip */}
              <span
                className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r opacity-0 group-data-[status=active]:opacity-100 transition-opacity"
                style={{ background: "linear-gradient(180deg, #FF006E, #8338EC)" }}
              />
              {/* Active gradient bg overlay */}
              <span
                className="absolute inset-0 rounded-lg opacity-0 group-data-[status=active]:opacity-[0.15] transition-opacity"
                style={{ background: "linear-gradient(90deg, #FF006E, #8338EC, transparent)" }}
              />
              <Icon className="size-4 shrink-0 relative z-10 group-data-[status=active]:text-[#FF006E] transition-colors" />
              <span className="relative z-10">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User card */}
        <div className="p-3">
          <div className="gradient-border p-3 flex items-center gap-3">
            <div
              className="size-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: "linear-gradient(135deg, #FF006E, #8338EC)" }}
            >
              R
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold truncate">you</div>
              <div className="text-[10px] font-mono-tight text-[#6B7280] truncate">
                v0.4.2 · noir
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Topbar */}
        <header
          className="sticky top-0 z-40 border-b border-white/[0.05]"
          style={{
            background: "rgba(7,7,8,0.75)",
            backdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          <div className="flex items-center justify-between gap-4 px-6 py-3">
            <div className="md:hidden font-display text-lg font-bold prism-text">refract</div>

            {/* Search pill */}
            <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-[#4B5563]" />
                <input
                  placeholder="Search anything…"
                  className="w-full pl-9 pr-3 py-2 text-[13px] rounded-full bg-[#16161C] border border-white/[0.05] placeholder:text-[#4B5563] focus:outline-none focus:border-transparent focus:ring-2 focus:ring-[#8338EC]/60 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Live ping */}
              <span className="hidden md:inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-semibold text-[#6B7280] mr-2">
                <span className="relative inline-flex">
                  <span className="size-1.5 rounded-full bg-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.6)]" />
                  <span className="absolute inset-0 size-1.5 rounded-full bg-[#39FF14] animate-ping opacity-75" />
                </span>
                streaming
              </span>

              <button className="relative size-9 rounded-lg hover:bg-white/[0.04] transition-colors flex items-center justify-center text-[#9CA3AF] hover:text-foreground">
                <Bell className="size-4" />
                <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[#FF006E] shadow-[0_0_6px_rgba(255,0,110,0.8)]" />
              </button>
              <SettingsDrawer />
            </div>
          </div>
        </header>
        <main className="px-4 md:px-8 py-6 md:py-10">{children}</main>
      </div>
      <Toaster theme="dark" />
    </div>
  );
}
