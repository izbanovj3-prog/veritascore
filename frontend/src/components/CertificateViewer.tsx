import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Download,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  X,
} from "lucide-react";
import { certificateDownloadUrl, certificatePdfUrl } from "../api/client";
import { useAuditState } from "../context/AuditStreamContext";

const STATUS_META: Record<string, { color: string; icon: typeof ShieldX }> = {
  PASS: { color: "var(--pass)", icon: ShieldCheck },
  FAIL: { color: "var(--fail)", icon: ShieldX },
  CONDITIONAL: { color: "var(--warn)", icon: ShieldAlert },
};

export default function CertificateViewer({ auditId }: { auditId: string }) {
  const navigate = useNavigate();
  const { complete, certificate, verified } = useAuditState();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape returns to the launcher; focus moves into the dialog on reveal.
  useEffect(() => {
    if (!complete) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [complete, navigate]);

  // Guard: the certificate panel only exists once the audit reports completion.
  if (!complete) return null;

  const status = complete.compliance_status ?? certificate?.compliance_status;
  const overall = complete.overall_score ?? certificate?.overall_score;
  const st = STATUS_META[status ?? "CONDITIONAL"] ?? STATUS_META.CONDITIONAL;
  const StatusIcon = st.icon;
  const error = complete.error;
  // complete but the signed certificate hasn't been fetched yet (and no abort error)
  const loading = !error && !certificate;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 backdrop-in"
      style={{ background: "oklch(0.09 0.012 250 / 0.88)", zIndex: "var(--z-modal)" as any }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-title"
        tabIndex={-1}
        className="panel glow w-full max-w-2xl p-7 cert-in relative"
      >
        <button
          type="button"
          className="absolute top-4 right-4 btn btn-ghost"
          style={{ padding: "6px" }}
          aria-label="Close certificate and return to launcher"
          onClick={() => navigate("/")}
        >
          <X size={16} aria-hidden="true" />
        </button>

        {error ? (
          <div>
            <h2 id="cert-title" className="panel-title mb-2">Audit aborted</h2>
            <p className="text-[14px]" style={{ color: "var(--fail)" }}>
              {error}
            </p>
            <p className="text-[12px] mt-2" style={{ color: "var(--muted)" }}>
              No certificate was issued. Verify the target URL is reachable and start a new audit.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-3 py-6">
            <Loader2 size={18} className="accent" aria-hidden="true" />
            <div>
              <h2 id="cert-title" className="panel-title">Finalizing certificate</h2>
              <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                Audit complete — signing and fetching the certificate.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="cert-title" className="panel-title mb-1">Signed audit certificate</h2>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {certificate?.target_model ?? "model"} · {auditId}
                </div>
              </div>
              <div className="flex items-center gap-2 pr-10" style={{ color: st.color }}>
                <StatusIcon size={26} aria-hidden="true" />
                <span className="text-xl font-extrabold display">{status}</span>
              </div>
            </div>

            <div className="flex items-end gap-6 mt-5 flex-wrap">
              <div>
                <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                  Overall compliance score
                </div>
                <div className="text-6xl font-extrabold leading-none display" style={{ color: st.color }}>
                  {overall ?? "—"}
                  <span className="text-2xl" style={{ color: "var(--muted)" }}>/100</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-3 text-center min-w-[260px]">
                <Metric label="Adv. ASR" value={certificate?.adversarial_score} />
                <Metric label="Drift" value={certificate?.drift_score} />
                <Metric
                  label="Failed"
                  value={certificate ? `${certificate.failed_probes}/${certificate.total_probes}` : undefined}
                />
              </div>
            </div>

            {certificate && (
              <div className="mt-5 space-y-2">
                <div
                  className="flex items-center gap-2 text-[12px]"
                  style={{ color: verified ? "var(--pass)" : "var(--fail)" }}
                  role="status"
                >
                  {verified ? <BadgeCheck size={15} aria-hidden="true" /> : <ShieldX size={15} aria-hidden="true" />}
                  {verified
                    ? "Ed25519 signature verified"
                    : "Signature invalid — do not trust this certificate"}
                </div>
                <Row label="Signature" value={certificate.signature ?? ""} mono truncate />
                <Row label="Public key" value={certificate.public_key_fingerprint ?? ""} mono />
                <Row
                  label="Violations"
                  value={
                    certificate.regulatory_violations.length
                      ? certificate.regulatory_violations.join("  ·  ")
                      : "None — no clauses violated"
                  }
                />
              </div>
            )}

            <div className="flex gap-3 mt-6 flex-wrap">
              <a className="btn flex items-center gap-2" href={certificateDownloadUrl(auditId)} download>
                <Download size={15} aria-hidden="true" /> Download JSON
              </a>
              <a className="btn btn-ghost flex items-center gap-2" href={certificatePdfUrl(auditId)} download>
                <FileText size={15} aria-hidden="true" /> Download PDF
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value?: number | string }) {
  return (
    <div className="rounded-lg py-2" style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
      <div className="text-[9px]" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-[15px] font-bold">{value ?? "—"}</div>
    </div>
  );
}

function Row({ label, value, mono, truncate }: { label: string; value: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="flex gap-3 text-[11px]">
      <div className="w-20 shrink-0" style={{ color: "var(--muted)" }}>{label}</div>
      <div className={`${mono ? "font-mono" : ""} ${truncate ? "truncate" : "break-all"}`} style={{ color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
