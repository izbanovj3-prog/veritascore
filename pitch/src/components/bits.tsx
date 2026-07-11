import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import type { Severity } from "../data";

export const EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* number that counts up on mount */
export function CountUp({
  to,
  decimals = 0,
  duration = 1.8,
  delay = 0,
  className,
}: {
  to: number;
  decimals?: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) {
      setV(to);
      return;
    }
    const ctrl = animate(0 as number, to, {
      duration,
      delay,
      ease: EXPO,
      onUpdate: setV,
    });
    return () => ctrl.stop();
  }, [to, duration, delay, reduce]);
  return <span className={className}>{v.toFixed(decimals)}</span>;
}

/* text that types itself in */
export function TypeLine({
  text,
  delay = 0,
  cps = 42,
  cursor = false,
  className,
}: {
  text: string;
  delay?: number;
  cps?: number;
  cursor?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) {
      setN(text.length);
      return;
    }
    setN(0);
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const el = ts - start - delay * 1000;
      const k = Math.max(0, Math.floor((el / 1000) * cps));
      setN(Math.min(text.length, k));
      if (k < text.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, delay, cps, reduce]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      {cursor && <span className="type-cursor" aria-hidden="true" />}
    </span>
  );
}

/* four corner brackets, drawing in (slides 1 & 8) */
export function Brackets({ delay = 0 }: { delay?: number }) {
  const reduce = useReducedMotion();
  const path = (
    <motion.path
      d="M 33 1 L 1 1 L 1 33"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="1.5"
      initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.9, delay, ease: EXPO }}
    />
  );
  return (
    <div className="brackets" aria-hidden="true">
      {(["tl", "tr", "bl", "br"] as const).map((pos) => (
        <svg key={pos} className={pos} viewBox="0 0 34 34">
          {path}
        </svg>
      ))}
    </div>
  );
}

export function SevBadge({ sev }: { sev: Severity }) {
  return <span className={`badge ${sev.toLowerCase()}`}>{sev}</span>;
}
