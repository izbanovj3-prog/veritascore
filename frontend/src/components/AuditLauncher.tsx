import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Rocket, Loader2, Crosshair } from "lucide-react";
import { startAudit } from "../api/client";

const DEMO_URL = "http://localhost:8001/v1/respond";
const DEMO = (import.meta as any).env?.VITE_DEMO_MODE === "1";

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
    <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden terminal-grid">
      <form
        onSubmit={launch}
        className="w-full max-w-2xl border border-border bg-surface p-10 relative"
      >
        {/* corner accents */}
        <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent" aria-hidden="true" />
        <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent" aria-hidden="true" />

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 border border-accent" aria-hidden="true">
            <ShieldCheck className="text-accent" size={28} />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Audit Launcher</h1>
            <p className="font-mono text-2xs text-muted tracking-[0.2em] uppercase">
              Deploy autonomous red-team audit
            </p>
          </div>
        </div>

        {DEMO && (
          <div className="mb-6 border border-accent-border bg-accent-dim px-3 py-2 font-mono text-2xs text-text">
            <span className="text-accent">●</span> RECORDED DEMO — the Python backend isn't hosted on
            GitHub Pages. Launch replays a real audit run (real probe stream + the real Ed25519-signed certificate).
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="target-url" className="font-mono text-xs uppercase font-bold flex items-center gap-2 text-text">
              <span className="w-1 h-1 bg-accent" aria-hidden="true" /> Target model endpoint
            </label>
            <input
              id="target-url"
              ref={urlRef}
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              inputMode="url"
              spellCheck={false}
              autoComplete="off"
              className="w-full bg-bg border border-border p-3 font-mono text-sm text-accent focus:outline-none focus:border-accent"
            />
            <p className="font-mono text-2xs text-dim uppercase">
              Six agents probe bias · adversarial · drift · GB/T 42118 + EU AI Act compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="model-name" className="font-mono text-xs uppercase font-bold flex items-center gap-2 text-text">
                <span className="w-1 h-1 bg-accent" aria-hidden="true" /> Model name / version
              </label>
              <input
                id="model-name"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-bg border border-border p-3 font-mono text-sm text-text focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="api-key" className="font-mono text-xs uppercase font-bold flex items-center gap-2 text-text">
                <span className="w-1 h-1 bg-accent" aria-hidden="true" /> API key (optional)
              </label>
              <input
                id="api-key"
                type="password"
                placeholder="bearer token"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                className="w-full bg-bg border border-border p-3 font-mono text-sm text-text placeholder:text-dim focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent text-bg py-4 font-display font-bold text-lg uppercase tracking-wide flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Rocket size={18} aria-hidden="true" />}
            {busy ? "Launching audit" : "Launch audit"}
          </button>

          {error && (
            <p className="font-mono text-xs text-danger" role="alert">
              ⚠ {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setTargetUrl(DEMO_URL);
                setModelName("demo-target-v1");
              }}
              className="flex items-center gap-2 font-mono text-2xs uppercase text-muted hover:text-accent"
            >
              <Crosshair size={13} aria-hidden="true" /> Use demo target
            </button>
            <div className="flex gap-4 font-mono text-2xs uppercase text-dim">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-accent" aria-hidden="true" /> Core_sync</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-accent" aria-hidden="true" /> Ed25519</span>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
