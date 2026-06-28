import { memo, useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { useAuditState } from "../context/AuditStreamContext";

const AXES = ["gender", "ethnicity", "age", "religion", "disability"];

// Read design tokens at runtime so Recharts SVG props carry no hardcoded hex.
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function BiasRadarImpl() {
  const { biasScores } = useAuditState();

  const data = useMemo(
    () =>
      AXES.map((axis) => ({
        axis: axis.toUpperCase(),
        value: Math.round((biasScores[axis] ?? 0) * 100) / 100,
      })),
    [biasScores]
  );

  const peak = useMemo(() => Math.max(0, ...AXES.map((a) => biasScores[a] ?? 0)), [biasScores]);

  const chart = useMemo(() => {
    const accent = cssVar("--color-accent", "cyan");
    const danger = cssVar("--color-danger", "tomato");
    const grid = cssVar("--color-border", "slategray");
    const muted = cssVar("--color-text-muted", "slategray");
    const valueByAxis: Record<string, number> = Object.fromEntries(data.map((d) => [d.axis, d.value]));

    const Tick = (props: any) => {
      const { payload, x, y, textAnchor } = props;
      const over = (valueByAxis[payload.value] ?? 0) > 0.6;
      return (
        <text x={x} y={y} textAnchor={textAnchor} fill={over ? danger : muted} fontSize={10} fontFamily="JetBrains Mono">
          {payload.value}
        </text>
      );
    };

    return (
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke={grid} />
          <PolarAngleAxis dataKey="axis" tick={<Tick />} />
          <PolarRadiusAxis domain={[0, 1]} tick={{ fill: muted, fontSize: 9 }} stroke={grid} axisLine={false} />
          <Radar
            dataKey="value"
            stroke={accent}
            strokeWidth={1.5}
            fill={accent}
            fillOpacity={0.2}
            dot={{ r: 3, fill: accent }}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    );
  }, [data]);

  const critical = peak > 0.12;

  return (
    <section aria-label="Bias disparity radar">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <h3 className="font-display text-2xs uppercase tracking-widest text-muted">Bias_Disparity</h3>
        <span className={`font-mono text-2xs ${critical ? "text-danger" : "text-muted"}`}>peak Δ {peak.toFixed(2)}</span>
      </div>
      <div className="h-56 px-2 pt-2" role="img" aria-label={`Bias disparity by attribute, peak ${peak.toFixed(2)}`}>
        {chart}
      </div>
      <p className="px-4 pb-3 font-mono text-2xs text-dim">0 = parity · 1 = maximal disparity</p>
    </section>
  );
}

export default memo(BiasRadarImpl);
