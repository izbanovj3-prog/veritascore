import {
  Crosshair,
  Scale,
  Swords,
  Activity,
  FileCheck2,
  Brain,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import { PHASES, phaseStatus, type PhaseStatus } from "../hooks/useAuditStream";
import { useAuditState } from "../context/AuditStreamContext";
import type { Phase } from "../types";

const META: Record<Phase, { label: string; icon: LucideIcon; blurb: string }> = {
  triage: { label: "Triage", icon: Crosshair, blurb: "Fingerprint target" },
  bias: { label: "Bias", icon: Scale, blurb: "Demographic parity" },
  adversarial: { label: "Adversarial", icon: Swords, blurb: "Injection · jailbreak" },
  drift: { label: "Drift", icon: Activity, blurb: "Baseline delta" },
  compliance: { label: "Compliance", icon: FileCheck2, blurb: "GB/T · EU AI Act" },
  meta: { label: "Meta", icon: Brain, blurb: "Evolve probes" },
  certificate: { label: "Certificate", icon: Stamp, blurb: "Sign & seal" },
  init: { label: "Init", icon: Crosshair, blurb: "" },
  complete: { label: "Complete", icon: Stamp, blurb: "" },
};

function dotColor(st: PhaseStatus) {
  if (st === "done") return "var(--pass)";
  if (st === "running") return "var(--accent)";
  return "var(--border-strong)";
}

export default function AgentTimeline() {
  const { phase, complete, infos } = useAuditState();
  const isComplete = !!complete;

  return (
    <div className="panel p-4">
      <h2 className="panel-title mb-4">Agent pipeline</h2>
      <ol className="relative" aria-label="Audit agent pipeline">
        {PHASES.map((p, i) => {
          const st = phaseStatus(p, phase, isComplete);
          const m = META[p];
          const Icon = m.icon;
          return (
            <li
              key={p}
              className="flex gap-3 pb-4 relative"
              aria-current={st === "running" ? "step" : undefined}
              aria-label={`${m.label}: ${st}`}
            >
              {i < PHASES.length - 1 && (
                <div
                  className="absolute left-[15px] top-8 bottom-0 w-px"
                  style={{ background: "var(--border)" }}
                  aria-hidden="true"
                />
              )}
              <div
                className="phase-marker w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{
                  border: `1px solid ${dotColor(st)}`,
                  background: st === "running" ? "oklch(0.84 0.14 200 / 0.14)" : "var(--bg-elev)",
                  color: dotColor(st),
                }}
              >
                <Icon size={15} aria-hidden="true" />
              </div>
              <div className="pt-1">
                <div
                  className="text-[12px] font-bold"
                  style={{ color: st === "waiting" ? "var(--muted)" : "var(--text)" }}
                >
                  {m.label}
                  {st === "running" && <span className="accent"> · running</span>}
                  {st === "done" && <span style={{ color: "var(--pass)" }} aria-hidden="true"> ✓</span>}
                </div>
                <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                  {m.blurb}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <h2 className="panel-title mt-2 mb-2">Agent log</h2>
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Agent log">
        {infos.length === 0 ? (
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            Triage agent has not reported yet.
          </p>
        ) : (
          infos.slice(-30).map((info, i) => (
            <div
              key={i}
              className="text-[11px]"
              style={{
                color:
                  info.level === "error"
                    ? "var(--fail)"
                    : info.synthesized
                      ? "var(--accent)"
                      : "var(--muted)",
              }}
            >
              <span style={{ color: "var(--accent-dim)" }} aria-hidden="true">›</span> {info.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
