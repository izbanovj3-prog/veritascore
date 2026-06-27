import { useAuditState } from "../context/AuditStreamContext";

const CELLS = [
  { key: "bias", match: (k: string) => k.startsWith("bias"), gb: "GB/T §6.3.2", eu: "Art.10(2)(f)", domain: "Data governance · non-discrimination" },
  { key: "adversarial.injection", match: (k: string) => k === "adversarial.injection", gb: "GB/T §6.4.1", eu: "Art.15(1)", domain: "Accuracy & robustness · injection" },
  { key: "adversarial.jailbreak", match: (k: string) => k === "adversarial.jailbreak", gb: "GB/T §6.4.1", eu: "Art.15(4)", domain: "Robustness · jailbreak resilience" },
  { key: "drift.factual", match: (k: string) => k === "drift.factual", gb: "GB/T §6.2.1", eu: "Art.13(1)", domain: "Transparency · factual stability" },
  { key: "drift.safety", match: (k: string) => k === "drift.safety", gb: "GB/T §6.2.2", eu: "Art.9(2)", domain: "Risk management · safety drift" },
];

type Status = "pending" | "violation" | "compliant";

function statusStyle(s: Status) {
  if (s === "violation") return { background: "oklch(0.68 0.2 18 / 0.16)", color: "var(--fail)", border: "1px solid oklch(0.68 0.2 18 / 0.45)" };
  if (s === "compliant") return { background: "oklch(0.8 0.16 155 / 0.12)", color: "var(--pass)", border: "1px solid oklch(0.8 0.16 155 / 0.4)" };
  return { background: "var(--bg-elev)", color: "var(--muted)", border: "1px solid var(--border)" };
}

export default function ComplianceMatrix() {
  const { compliance } = useAuditState();
  const ran = compliance.length > 0;

  return (
    <section className="panel p-4" aria-label="Compliance matrix">
      <h2 className="panel-title mb-3">Compliance matrix · GB/T 42118-2023 × EU AI Act</h2>
      <div className="space-y-1.5">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[9px]" style={{ color: "var(--muted)" }}>
          <div>Regulatory domain</div>
          <div className="text-center w-[78px]">GB/T</div>
          <div className="text-center w-[88px]">EU AI Act</div>
        </div>
        {CELLS.map((cell) => {
          const hit = compliance.find((f) => cell.match(f.clause_key));
          const status: Status = hit ? "violation" : ran ? "compliant" : "pending";
          const st = statusStyle(status);
          return (
            <div key={cell.key} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
              <div className="text-[11px]">{cell.domain}</div>
              <div className="text-[10px] text-center rounded px-1 py-1.5 w-[78px]" style={st} aria-label={`${cell.gb}: ${status}`}>
                {cell.gb}
              </div>
              <div className="text-[10px] text-center rounded px-1 py-1.5 w-[88px]" style={st} aria-label={`${cell.eu}: ${status}`}>
                {cell.eu}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 text-[9px]" style={{ color: "var(--muted)" }}>
        <span><span aria-hidden="true" style={{ color: "var(--fail)" }}>■</span> violation</span>
        <span><span aria-hidden="true" style={{ color: "var(--pass)" }}>■</span> compliant</span>
        <span><span aria-hidden="true" style={{ color: "var(--border-strong)" }}>■</span> not tested</span>
      </div>
    </section>
  );
}
