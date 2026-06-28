import { useAuditState } from "../context/AuditStreamContext";

const CELLS = [
  { key: "bias", match: (k: string) => k.startsWith("bias"), domain: "Data governance", gb: "§6.3.2", eu: "Art.10(2)(f)" },
  { key: "adversarial.injection", match: (k: string) => k === "adversarial.injection", domain: "Robustness · injection", gb: "§6.4.1", eu: "Art.15(1)" },
  { key: "adversarial.jailbreak", match: (k: string) => k === "adversarial.jailbreak", domain: "Robustness · jailbreak", gb: "§6.4.1", eu: "Art.15(4)" },
  { key: "drift.factual", match: (k: string) => k === "drift.factual", domain: "Transparency · drift", gb: "§6.2.1", eu: "Art.13(1)" },
  { key: "drift.safety", match: (k: string) => k === "drift.safety", domain: "Risk mgmt · safety", gb: "§6.2.2", eu: "Art.9(2)" },
];

type Status = "not_tested" | "compliant" | "violation";

function cellClasses(s: Status): string {
  if (s === "violation") return "bg-danger-dim text-danger";
  if (s === "compliant") return "bg-success-dim text-success";
  return "bg-surface text-dim";
}
function glyph(s: Status): string {
  if (s === "violation") return "✗";
  if (s === "compliant") return "✓";
  return "·";
}

export default function ComplianceMatrix() {
  const { compliance } = useAuditState();
  const ran = compliance.length > 0;

  return (
    <section aria-label="Compliance matrix">
      <div className="px-4 py-2 border-b border-border border-t">
        <h3 className="font-display text-2xs uppercase tracking-widest text-muted">Regulatory Compliance Map</h3>
        <p className="font-display text-xs text-text mt-0.5">GB/T 42118-2023 × EU AI Act</p>
      </div>
      <div className="p-3">
        <table className="w-full border-collapse font-mono">
          <thead>
            <tr>
              <th className="border border-border bg-surface-2 text-left text-2xs uppercase tracking-wider text-muted px-2 py-1.5 font-normal">
                Domain
              </th>
              <th className="border border-border bg-surface-2 text-center text-2xs uppercase tracking-wider text-muted px-2 py-1.5 font-normal">
                GB/T
              </th>
              <th className="border border-border bg-surface-2 text-center text-2xs uppercase tracking-wider text-muted px-2 py-1.5 font-normal">
                EU AI Act
              </th>
            </tr>
          </thead>
          <tbody>
            {CELLS.map((cell) => {
              const hit = compliance.find((f) => cell.match(f.clause_key));
              const status: Status = hit ? "violation" : ran ? "compliant" : "not_tested";
              const cc = cellClasses(status);
              return (
                <tr key={cell.key}>
                  <th scope="row" className="border border-border bg-surface text-left text-2xs text-text px-2 py-2 font-normal">
                    {cell.domain}
                  </th>
                  <td className={`border border-border text-center text-2xs px-2 py-2 ${cc}`} aria-label={`${cell.gb}: ${status}`}>
                    <span aria-hidden="true">{glyph(status)}</span> {cell.gb}
                  </td>
                  <td className={`border border-border text-center text-2xs px-2 py-2 ${cc}`} aria-label={`${cell.eu}: ${status}`}>
                    <span aria-hidden="true">{glyph(status)}</span> {cell.eu}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
