import { useEffect, useState } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.2,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState("0");
  const rounded = useTransform(mv, (v) => v.toFixed(decimals));

  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [value, duration, mv, rounded]);

  return (
    <motion.span className="font-mono-tight tabular-nums">
      {prefix}
      {display}
      {suffix}
    </motion.span>
  );
}
