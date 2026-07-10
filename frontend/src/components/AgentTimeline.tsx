import {
  Crosshair,
  Scale,
  Swords,
  Activity,
  FileCheck2,
  Brain,
  Stamp,
  Check,
  BadgeCheck,
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
  compliance: { label: "Compliance", icon: FileCheck2, blurb: "EU AI Act (illustrative)" },
  meta: { label: "Meta", icon: Brain, blurb: "Evolve probes" },
  certificate: { label: "Certificate", icon: Stamp, blurb: "Sign & seal" },
  init: { label: "Init", icon: Crosshair, blurb: "" },
  complete: { label: "Complete", icon: Stamp, blurb: "" },
};

function StatusGlyph({ st }: { st: PhaseStatus }) {
  if (st === "done") return <Check size={16} className="text-success" aria-hidden="true" />;
  if (st === "running")
    return (
      <span className="status-running inline-flex" aria-hidden="true">
        <span className="w-2 h-2 rounded-full bg-accent" />
      </span>
    );
  return <span className="w-2 h-2 rounded-full border border-dim" aria-hidden="true" />;
}

export default function AgentTimeline() {
  const { phase, complete, infos } = useAuditState();
  const isComplete = !!complete;

  return (
    <div className="flex flex-col">
      {/* Operator badge */}
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 border border-accent bg-accent-dim flex items-center justify-center shrink-0">
          <BadgeCheck size={18} className="text-accent" aria-hidden="true" />
        </div>
        <div className="overflow-hidden">
          <p className="font-display font-bold text-xs text-accent whitespace-nowrap">RED-TEAM AGENTS</p>
          <p className="font-mono text-2xs text-muted">AUDIT_PIPELINE / 7</p>
        </div>
      </div>

      {/* Phase list — no gaps, active phase gets a 2px cyan left border */}
      <ol aria-label="Audit agent pipeline">
        {PHASES.map((p, i) => {
          const st = phaseStatus(p, phase, isComplete);
          const m = META[p];
          const active = st === "running";
          return (
            <li
              key={p}
              aria-current={active ? "step" : undefined}
              aria-label={`${m.label}: ${st}`}
              className={`px-4 py-3 border-l-2 ${active ? "border-accent" : "border-transparent"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-2xs text-dim w-5 text-right">{String(i + 1).padStart(2, "0")}</span>
                  <span
                    className={`font-display font-bold text-sm uppercase truncate ${
                      st === "waiting" ? "text-muted" : "text-text"
                    }`}
                  >
                    {m.label}
                  </span>
                </div>
                <StatusGlyph st={st} />
              </div>
              <div className="font-mono text-2xs text-dim ml-8 mt-0.5">
                {active ? <span className="text-accent">RUNNING</span> : m.blurb}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Agent log */}
      <div className="border-t border-border flex flex-col">
        <div className="px-4 py-2 font-display text-2xs uppercase tracking-widest text-muted border-b border-border">
          Agent log
        </div>
        <div className="max-h-48 overflow-y-auto focus:outline-none px-4 py-2 space-y-1" role="log" tabIndex={0} aria-live="polite" aria-label="Agent log">
          {infos.length === 0 ? (
            <p className="font-mono text-2xs text-dim">Triage agent has not reported yet.</p>
          ) : (
            infos.slice(-40).map((info, i) => (
              <div
                key={i}
                className={`font-mono text-2xs leading-snug ${
                  info.level === "error" ? "text-danger" : info.synthesized ? "text-accent" : "text-muted"
                }`}
              >
                <span className="text-accent" aria-hidden="true">&rsaquo;</span> {info.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
