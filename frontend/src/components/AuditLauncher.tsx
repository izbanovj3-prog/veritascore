import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Loader2, Crosshair } from "lucide-react";
import { startAudit } from "../api/client";

const DEMO_URL = "http://localhost:8001/v1/respond";

export default function AuditLauncher() {
  const navigate = useNavigate();
  const [targetUrl, setTargetUrl] = useState(DEMO_URL);
  const [modelName, setModelName] = useState("production-model");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  async function launch(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { audit_id } = await startAudit({
        target_url: targetUrl,
        model_name: modelName || "unknown",
        api_key: apiKey || undefined,
      });
      navigate(`/audit/${audit_id}`);
    } catch (err: any) {
      setError(`Could not start audit — backend unreachable (${err?.message ?? "network error"})`);
      setBusy(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <form className="panel glow p-8" onSubmit={launch}>
        <h1 className="text-2xl font-extrabold mb-2">
          Audit a production AI model<span className="accent">.</span>
        </h1>
        <p className="text-[13px] mb-7" style={{ color: "var(--muted)", maxWidth: "62ch" }}>
          Six autonomous agents stress-test the target for bias, adversarial vulnerability,
          behavioral drift, and GB/T 42118-2023 + EU AI Act compliance, then issue a
          cryptographically signed certificate.
        </p>

        <label htmlFor="target-url" className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
          Target model API URL
        </label>
        <input
          id="target-url"
          ref={urlRef}
          className="input mb-4"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          inputMode="url"
          spellCheck={false}
          autoComplete="off"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="model-name" className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
              Model name / version
            </label>
            <input id="model-name" className="input" value={modelName} onChange={(e) => setModelName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="api-key" className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
              API key (optional)
            </label>
            <input
              id="api-key"
              className="input"
              type="password"
              placeholder="bearer token"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-7 flex-wrap">
          <button type="submit" className="btn flex items-center gap-2" disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {busy ? "Launching audit" : "Launch audit"}
          </button>
          <button
            type="button"
            className="btn btn-ghost flex items-center gap-2"
            onClick={() => {
              setTargetUrl(DEMO_URL);
              setModelName("demo-target-v1");
            }}
          >
            <Crosshair size={16} aria-hidden="true" /> Use demo target
          </button>
        </div>

        {error && (
          <p className="mt-4 text-[12px]" style={{ color: "var(--fail)" }} role="alert">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
