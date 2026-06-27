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

function BiasRadarImpl() {
  const { biasScores } = useAuditState();

  const data = useMemo(
    () =>
      AXES.map((axis) => ({
        axis: axis[0].toUpperCase() + axis.slice(1),
        value: Math.round((biasScores[axis] ?? 0) * 100) / 100,
      })),
    [biasScores]
  );

  const peak = useMemo(
    () => Math.max(0, ...AXES.map((a) => biasScores[a] ?? 0)),
    [biasScores]
  );

  // The Recharts subtree only rebuilds when bias scores change (twice per audit),
  // not on every streamed probe. Animation is off for deterministic, jank-free updates.
  const chart = useMemo(
    () => (
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="oklch(0.31 0.02 250)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "oklch(0.78 0.02 245)", fontSize: 11 }} />
          <PolarRadiusAxis
            domain={[0, 1]}
            tick={{ fill: "oklch(0.6 0.02 250)", fontSize: 9 }}
            stroke="oklch(0.31 0.02 250)"
          />
          <Radar
            dataKey="value"
            stroke="oklch(0.84 0.14 200)"
            fill="oklch(0.84 0.14 200)"
            fillOpacity={0.32}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    ),
    [data]
  );

  return (
    <section className="panel p-4" aria-label="Bias disparity radar">
      <div className="flex items-center justify-between mb-1">
        <h2 className="panel-title">Bias disparity</h2>
        <div className="text-[10px]" style={{ color: peak > 0.12 ? "var(--fail)" : "var(--muted)" }}>
          peak Δ {peak.toFixed(2)}
        </div>
      </div>
      <div style={{ width: "100%", height: 230 }} role="img" aria-label={`Disparity by attribute, peak ${peak.toFixed(2)}`}>
        {chart}
      </div>
      <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>
        0 = parity · 1 = maximal disparity across paired probes
      </p>
    </section>
  );
}

export default memo(BiasRadarImpl);
