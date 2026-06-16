import { useRef, type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  spotlight?: boolean;
}

export function GlassCard({ children, className, spotlight = true, ...rest }: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!spotlight || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn("glass-card grain", spotlight && "spotlight", "glass-card-hover", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
