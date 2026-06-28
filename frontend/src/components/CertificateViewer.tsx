import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Download, FileText, Loader2, ShieldX, X } from "lucide-react";
import { certificateDownloadUrl, certificatePdfUrl } from "../api/client";
import { useAuditState } from "../context/AuditStreamContext";

const STRIP: Record<string, string> = {
  PASS: "bg-success",
  FAIL: "bg-danger",
  CONDITIONAL: "bg-warning",
};
const STATUS_BADGE: Record<string, string> = {
  PASS: "bg-success text-bg",
  FAIL: "bg-danger text-bg",
  CONDITIONAL: "bg-warning text-bg",
};

export default function CertificateViewer({ auditId }: { auditId: string }) {
  const navigate = useNavigate();
  const { complete, certificate, verified } = useAuditState();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!complete) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [complete, navigate]);

  if (!complete) return null;

  const status = (complete.compliance_status ?? certificate?.compliance_status ?? "CONDITIONAL") as string;
  const overall = complete.overall_score ?? certificate?.overall_score;
  const error = complete.error;
  const loading = !error && !certificate;
  const sig = certificate?.signature ?? "";
  const sigShort = sig.length > 32 ? sig.slice(0, 32) + "…" : sig;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cert-scrim backdrop-in" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-title"
        tabIndex={-1}
        className="cert-in relative w-full max-w-[640px] border border-border bg-surface"
      >
        <div className={`h-0.5 w-full ${STRIP[status] ?? "bg-warning"}`} aria-hidden="true" />

        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Close certificate and return to launcher"
          className="absolute top-3 right-3 p-1.5 border border-border text-muted hover:text-text hover:border-accent"
        >
          <X size={15} aria-hidden="true" />
        </button>

        {error ? (
          <div className="p-8">
            <h2 id="cert-title" className="font-display text-xs uppercase tracking-widest text-muted mb-2">
              Audit aborted
            </h2>
            <p className="font-mono text-base text-danger">{error}</p>
            <p className="font-mono text-sm text-muted mt-2">
              No certificate was issued. Verify the target endpoint is reachable, then start a new audit.
            </p>
          </div>
        ) : loading ? (
          <div className="p-8 flex items-center gap-3">
            <Loader2 size={18} className="text-accent animate-spin" aria-hidden="true" />
            <div>
              <h2 id="cert-title" className="font-display text-xs uppercase tracking-widest text-muted">
                Finalizing certificate
              </h2>
              <p className="font-mono text-sm text-muted">Audit complete — signing and fetching the certificate.</p>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <h2 id="cert-title" className="font-display text-xs uppercase tracking-widest text-muted">
                  Signed audit certificate
                </h2>
                <p className="font-mono text-xs text-muted mt-1">
                  {certificate?.target_model ?? "model"} · {auditId}
                </p>
              </div>
              <span className={`font-display font-bold text-sm uppercase px-3 py-1 ${STATUS_BADGE[status] ?? "bg-warning text-bg"}`}>
                {status}
              </span>
            </div>

            <div className="text-center py-6">
              <div className="font-mono font-bold text-white leading-none text-[length:var(--text-display)]">
                {overall ?? "—"}
                <span className="text-muted text-xl">/100</span>
              </div>
              <div className="font-display text-2xs uppercase tracking-widest text-muted mt-1">Overall compliance score</div>
            </div>

            <div className="border-t border-border" />

            <div
              className={`flex items-center gap-2 py-3 font-mono text-sm ${verified ? "text-success" : "text-danger"}`}
              role="status"
            >
              {verified ? <BadgeCheck size={15} aria-hidden="true" /> : <ShieldX size={15} aria-hidden="true" />}
              {verified ? "Ed25519 signature verified" : "Signature invalid — do not trust this certificate"}
            </div>

            <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 border-t border-border pt-3">
              <Field label="Audit ID" value={auditId} />
              <Field label="Signature" value={sigShort} />
              <Field label="Public key" value={certificate?.public_key_fingerprint ?? ""} />
            </dl>

            <div className="border-t border-border mt-3 pt-3">
              <div className="font-display text-2xs uppercase tracking-widest text-muted mb-2">Regulatory violations</div>
              {certificate && certificate.regulatory_violations.length > 0 ? (
                <ul className="space-y-1">
                  {certificate.regulatory_violations.map((v) => (
                    <li key={v} className="font-mono text-xs text-accent">
                      ✗ {v}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-xs text-success">None — no clauses violated</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <a
                href={certificateDownloadUrl(auditId)}
                download
                className="flex items-center justify-center gap-2 border border-accent text-accent py-3 font-display font-bold text-sm uppercase hover:bg-accent-dim"
              >
                <Download size={15} aria-hidden="true" /> JSON
              </a>
              <a
                href={certificatePdfUrl(auditId)}
                download
                className="flex items-center justify-center gap-2 border border-accent text-accent py-3 font-display font-bold text-sm uppercase hover:bg-accent-dim"
              >
                <FileText size={15} aria-hidden="true" /> PDF
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-display text-2xs uppercase tracking-wider text-muted self-center">{label}</dt>
      <dd className="font-mono text-sm text-text break-all">{value}</dd>
    </>
  );
}
