import { motion, useReducedMotion } from "framer-motion";
import { EXPO } from "./bits";

export interface RadarAxis {
  label: string;
  value: number; // 0..1 parity delta
  flagged: boolean;
  delta: string;
}

const CX = 210;
const CY = 162;
const R = 110;
const THRESHOLD = 0.25;

function pt(i: number, r: number): [number, number] {
  const a = ((-90 + i * 60) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function hexPath(rs: number[]): string {
  return (
    rs
      .map((r, i) => {
        const [x, y] = pt(i, r);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ") + " Z"
  );
}

const displayR = (v: number) => (v <= 0 ? 0 : R * Math.max(v, 0.05));

/*
  The deck's carried motif: the bias radar from the product dashboard.
  mode "draw" — outline draws itself on entry (title slide)
  mode "grow" — vertices animate outward axis-by-axis as `reveal` rises (live audit)
*/
export function Radar({
  axes,
  mode = "draw",
  reveal,
  delay = 0,
  showThresholdLabel = true,
}: {
  axes: RadarAxis[];
  mode?: "draw" | "grow";
  reveal?: number;
  delay?: number;
  showThresholdLabel?: boolean;
}) {
  const reduce = useReducedMotion();
  const shown = mode === "grow" ? (reveal ?? axes.length) : axes.length;
  const values = axes.map((a, i) => (i < shown ? a.value : 0));
  const d = hexPath(values.map(displayR));
  const dZero = hexPath(values.map(() => 0));

  return (
    <svg viewBox="0 0 420 330" style={{ overflow: "visible" }} role="img" aria-label="Demographic parity radar — gender axis flagged at delta 0.53">
      {/* grid rings */}
      {[0.5, 0.75, 1].map((f) => (
        <path key={f} d={hexPath(axes.map(() => R * f))} fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {/* parity threshold ring */}
      <path
        d={hexPath(axes.map(() => R * THRESHOLD))}
        fill="none"
        stroke="var(--danger)"
        strokeWidth="1"
        strokeDasharray="3 4"
        opacity="0.55"
      />
      {showThresholdLabel && (
        <text
          x={CX + 8}
          y={CY - R * THRESHOLD - 5}
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="var(--danger)"
          opacity="0.75"
        >
          PARITY 0.25
        </text>
      )}
      {/* axis spokes + labels */}
      {axes.map((a, i) => {
        const [x, y] = pt(i, R);
        const [lx, ly] = pt(i, R + 16);
        const anchor = i === 0 || i === 3 ? "middle" : i < 3 ? "start" : "end";
        const dy = i === 0 ? -2 : i === 3 ? 10 : 4;
        return (
          <g key={a.label}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke="var(--border-dim)" strokeWidth="1" />
            <text
              x={lx}
              y={ly + dy}
              textAnchor={anchor}
              fontFamily="var(--font-mono)"
              fontSize="12"
              letterSpacing="0.08em"
              fill={a.flagged && i < shown ? "var(--danger)" : "var(--muted)"}
            >
              {a.label}
            </text>
          </g>
        );
      })}

      {/* value shape */}
      {mode === "draw" ? (
        <>
          <motion.path
            d={d}
            fill="var(--accent-dim)"
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: delay + 1.1 }}
          />
          <motion.path
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.6"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay, ease: EXPO }}
          />
        </>
      ) : (
        <>
          <motion.path
            initial={{ d: reduce ? d : dZero }}
            animate={{ d }}
            transition={{ duration: 0.7, ease: EXPO }}
            fill="var(--accent-dim)"
            stroke="var(--accent)"
            strokeWidth="1.6"
          />
          {axes.map((a, i) =>
            i < shown && !a.flagged ? (
              <circle key={a.label} cx={pt(i, displayR(a.value))[0]} cy={pt(i, displayR(a.value))[1]} r="2.5" fill="var(--accent)" />
            ) : null
          )}
        </>
      )}

      {/* flagged vertex: red dot + delta tag */}
      {axes.map((a, i) => {
        if (!a.flagged || i >= shown) return null;
        const [x, y] = pt(i, displayR(a.value));
        return (
          <motion.g
            key={a.label}
            initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: mode === "draw" ? delay + 1.7 : 0.2, ease: EXPO }}
            style={{ transformOrigin: `${x}px ${y}px` }}
          >
            <circle cx={x} cy={y} r="4.5" fill="var(--danger)" />
            <circle cx={x} cy={y} r="9" fill="none" stroke="var(--danger)" strokeWidth="1" opacity="0.5" />
            <text
              x={x + 16}
              y={y + 4}
              fontFamily="var(--font-mono)"
              fontSize="12.5"
              fontWeight="700"
              fill="var(--danger)"
            >
              {a.delta}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}
