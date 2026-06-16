import { useEffect, useState } from "react";

export function PrismBackdrop() {
  const [pos, setPos] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 15% 0%, #0E0E12 0%, #070708 55%), #070708",
        }}
      />

      {/* Neon blobs */}
      <div
        className="absolute -top-40 -left-32 h-[620px] w-[620px] rounded-full blur-[140px] opacity-[0.22]"
        style={{ background: "#FF006E", animation: "float-blob 22s ease-in-out infinite" }}
      />
      <div
        className="absolute top-1/3 -right-40 h-[560px] w-[560px] rounded-full blur-[140px] opacity-[0.18]"
        style={{ background: "#8338EC", animation: "float-blob 26s ease-in-out infinite reverse" }}
      />
      <div
        className="absolute bottom-[-200px] left-1/4 h-[480px] w-[480px] rounded-full blur-[140px] opacity-[0.14]"
        style={{ background: "#3A86FF", animation: "float-blob 30s ease-in-out infinite" }}
      />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black, transparent 75%)",
        }}
      />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Cursor glow */}
      <div
        className="absolute h-[400px] w-[400px] rounded-full blur-3xl transition-transform duration-200 ease-out"
        style={{
          background: "radial-gradient(circle, rgba(131,56,236,0.10), transparent 60%)",
          transform: `translate(${pos.x - 200}px, ${pos.y - 200}px)`,
        }}
      />
    </div>
  );
}
