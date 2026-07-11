import { memo, useMemo } from "react";
import { useAuditState } from "../context/AuditStreamContext";
import type { ProbeResultEvent } from "../types";

// Protected axes, in draw order. Matches the backend bias evaluator + the deck.
const AXES = ["gender", "ethnicity", "age", "religion", "disability"] as const;

// Disparity above this is a discriminatory divergence — the dashed "parity"
// ring and the red vertex flag both key off it (mirrors the deck's 0.25 ring).
const PARITY_THRESHOLD = 0.25;
// Subtle expected-range envelope shown before real data arrives, so the radar
// is never an empty shell on mount.
const PLACEHOLDER = 0.08;

// Wide viewBox (320) with the chart centred at CX=160 leaves horizontal room
// for the extreme-left/right axis labels ("DISABILITY", "ETHNICITY") so they
// never clip against the ~320px telemetry panel edge.
const CX = 160;
const CY = 110;
const R = 78;

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function pt(i: number, r: number): [number, number] {
  const a = ((-90 + i * (360 / AXES.length)) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function polygon(values: number[]): string {
  return (
    values
      .map((v, i) => {
        const [x, y] = pt(i, R * Math.min(Math.max(v, 0), 1));
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

function BiasRadarImpl() {
  const { biasScores, probes } = useAuditState();

  // Derive a running per-axis disparity from the streamed bias probes so the
  // radar fills in axis-by-axis as results arrive — not only when the single
  // bias_update batch lands. Each paired probe carries its pair's disparity in
  // `score`; the per-attribute value is their mean (same semantics as the
  // final bias_update).
  const streamed = useMemo(() => {
    const sum: Record<string, number> = {};
    const n: Record<string, number> = {};
    for (const p of probes as ProbeResultEvent[]) {
      if (p.category !== "bias" || !p.protected_attribute) continue;
      sum[p.protected_attribute] = (sum[p.protected_attribute] ?? 0) + p.score;
      n[p.protected_attribute] = (n[p.protected_attribute] ?? 0) + 1;
    }
    const out: Record<string, number> = {};
    for (const a of Object.keys(n)) out[a] = sum[a] / n[a];
    return out;
  }, [probes]);

  // Real value per axis: prefer the authoritative bias_update, fall back to the
  // running stream, else null (→ placeholder).
  const axes = useMemo(
    () =>
      AXES.map((axis) => {
        const real = biasScores[axis] ?? streamed[axis];
        return {
          axis,
          real: real ?? null,
          display: real ?? PLACEHOLDER,
          flagged: real != null && real > PARITY_THRESHOLD,
        };
      }),
    [biasScores, streamed]
  );

  const hasReal = axes.some((a) => a.real != null);
  const peak = Math.max(0, ...axes.map((a) => a.real ?? 0));
  const critical = peak > PARITY_THRESHOLD;

  const colors = useMemo(
    () => ({
      // Fallbacks are CSS named colors (never hex) so the tokens file stays the
      // sole source of hex; these only apply if getComputedStyle returns empty.
      accent: cssVar("--color-accent", "cyan"),
      danger: cssVar("--color-danger", "crimson"),
      grid: cssVar("--color-border", "slategray"),
      muted: cssVar("--color-text-muted", "slategray"),
    }),
    []
  );

  const shape = polygon(axes.map((a) => a.display));

  return (
    <section aria-label="Bias disparity radar">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <h3 className="font-display text-2xs uppercase tracking-widest text-muted">Bias_Disparity</h3>
        <span className={`font-mono text-2xs ${critical ? "text-danger" : "text-muted"}`}>
          peak Δ {peak.toFixed(2)}
        </span>
      </div>

      <div
        className="px-2 pt-3 pb-1"
        role="img"
        aria-label={
          hasReal
            ? `Bias disparity by attribute. Peak ${peak.toFixed(2)}${
                critical ? ", above the 0.25 parity threshold" : ""
              }.`
            : "Bias disparity radar, awaiting probe results."
        }
      >
        <svg viewBox="0 0 320 210" className="w-full h-auto" style={{ overflow: "visible" }}>
          {/* grid rings */}
          {[0.5, 0.75, 1].map((f) => (
            <path key={f} d={polygon(AXES.map(() => f))} fill="none" stroke={colors.grid} strokeWidth="1" />
          ))}
          {/* parity threshold ring */}
          <path
            d={polygon(AXES.map(() => PARITY_THRESHOLD))}
            fill="none"
            stroke={colors.danger}
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.55"
          />
          <text
            x={CX + 6}
            y={CY - R * PARITY_THRESHOLD - 4}
            fontFamily="var(--font-mono)"
            fontSize="8"
            fill={colors.danger}
            opacity="0.75"
          >
            PARITY {PARITY_THRESHOLD}
          </text>

          {/* spokes + axis labels */}
          {axes.map((a, i) => {
            const [x, y] = pt(i, R);
            const [lx, ly] = pt(i, R + 13);
            const c = Math.cos(((-90 + i * (360 / AXES.length)) * Math.PI) / 180);
            const anchor = Math.abs(c) < 0.3 ? "middle" : c > 0 ? "start" : "end";
            return (
              <g key={a.axis}>
                <line x1={CX} y1={CY} x2={x} y2={y} stroke={colors.grid} strokeWidth="1" opacity="0.5" />
                <text
                  x={lx}
                  y={ly + 3}
                  textAnchor={anchor}
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  letterSpacing="0.06em"
                  fill={a.flagged ? colors.danger : colors.muted}
                >
                  {a.axis.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* value shape */}
          <path
            d={shape}
            fill={colors.accent}
            fillOpacity={hasReal ? 0.18 : 0.07}
            stroke={colors.accent}
            strokeWidth="1.5"
            strokeOpacity={hasReal ? 1 : 0.5}
          />

          {/* per-axis vertices; flagged axes get a red dot + Δ annotation */}
          {axes.map((a, i) => {
            if (a.real == null) return null;
            const [x, y] = pt(i, R * Math.min(a.real, 1));
            if (!a.flagged) return <circle key={a.axis} cx={x} cy={y} r="2.5" fill={colors.accent} />;
            const c = Math.cos(((-90 + i * (360 / AXES.length)) * Math.PI) / 180);
            const tx = x + (c >= 0 ? 8 : -8);
            return (
              <g key={a.axis}>
                <circle cx={x} cy={y} r="4" fill={colors.danger} />
                <circle cx={x} cy={y} r="7.5" fill="none" stroke={colors.danger} strokeWidth="1" opacity="0.5" />
                <text
                  x={tx}
                  y={y + 3}
                  textAnchor={c >= 0 ? "start" : "end"}
                  fontFamily="var(--font-mono)"
                  fontSize="10"
                  fontWeight="700"
                  fill={colors.danger}
                >
                  {a.axis.toUpperCase()} Δ{a.real.toFixed(2)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="px-4 pb-3 font-mono text-2xs text-dim">0 = parity · 1 = maximal disparity</p>
    </section>
  );
}

export default memo(BiasRadarImpl);
