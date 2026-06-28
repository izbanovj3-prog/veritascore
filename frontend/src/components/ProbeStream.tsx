import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Radio } from "lucide-react";
import { useAuditState } from "../context/AuditStreamContext";
import type { ProbeResultEvent } from "../types";

const FILTERS = ["all", "bias", "adversarial", "jailbreak", "drift"] as const;
type Filter = (typeof FILTERS)[number];

function isCritical(p: ProbeResultEvent): boolean {
  return !p.passed && p.severity === "critical";
}
function verdictLabel(p: ProbeResultEvent): string {
  if (isCritical(p)) return "CRITICAL";
  return p.passed ? "PASS" : "FAIL";
}
function badgeClasses(p: ProbeResultEvent): string {
  if (isCritical(p)) return "bg-danger-solid text-bg ring-1 ring-text";
  if (!p.passed) return "bg-danger text-bg";
  return "bg-success text-bg";
}
function hhmmss(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour12: false });
  } catch {
    return "";
  }
}

export default function ProbeStream() {
  const { probes, connection } = useAuditState();
  const [filter, setFilter] = useState<Filter>("all");
  const parentRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const filtered = useMemo(
    () => (filter === "all" ? probes : probes.filter((p) => p.category === filter)),
    [probes, filter]
  );

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 41,
    overscan: 12,
  });

  useEffect(() => {
    if (stick.current && filtered.length > 0) {
      virtualizer.scrollToIndex(filtered.length - 1, { align: "end" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length]);

  const emptyMessage =
    connection === "closed"
      ? "Audit stream closed before the first probe."
      : connection === "reconnecting"
        ? "Reconnecting to the audit stream"
        : connection === "connecting"
          ? "Connecting to the audit stream"
          : "Waiting for the triage agent to begin probing";

  const live = connection === "live";

  return (
    <section className="flex flex-col h-full min-h-0 bg-bg" aria-label="Live probe stream">
      {/* Feed header */}
      <div className="h-12 flex-shrink-0 border-b border-border bg-surface px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Radio size={16} className={live ? "text-accent status-running" : "text-muted"} aria-hidden="true" />
          <h2 className="font-display font-bold text-sm tracking-widest uppercase">Probe_Feed</h2>
          <span
            className={`px-2 py-0.5 border text-2xs font-mono uppercase ${
              live ? "border-accent text-accent" : "border-border text-muted"
            }`}
          >
            {live ? "Live_Probe" : connection}
          </span>
        </div>
        <div className="flex gap-1" role="group" aria-label="Filter probes by category">
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={active}
                className={`font-mono text-2xs uppercase px-2 py-1 border ${
                  active ? "border-accent text-accent bg-accent-dim" : "border-border text-muted hover:text-text"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="flex-1 flex items-center justify-center font-mono text-sm text-muted text-center px-6"
          role="status"
          aria-live="polite"
        >
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={parentRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
          className="flex-1 overflow-y-auto focus:outline-none"
          role="log"
          tabIndex={0}
          aria-label="Probe results"
          aria-live="polite"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const p = filtered[vi.index];
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
                >
                  <div className="probe-in flex items-center gap-3 px-4 py-2 border-b border-border hover:bg-surface-2">
                    <span
                      className={`probe-badge w-16 shrink-0 text-center rounded-pill text-2xs font-bold py-0.5 ${badgeClasses(p)}`}
                      aria-label={`${verdictLabel(p)} — probe ${p.probe_id}`}
                    >
                      {verdictLabel(p)}
                    </span>
                    <span className="w-28 shrink-0 text-center border border-border text-2xs text-muted uppercase py-0.5 truncate">
                      {p.category}/{p.subcategory}
                    </span>
                    {p.synthetic && (
                      <span className="shrink-0 text-2xs text-accent border border-accent-border px-1.5 py-0.5 uppercase">
                        syn
                      </span>
                    )}
                    <span className="flex-1 min-w-0 font-mono text-xs text-text truncate" title={p.finding}>
                      {p.finding}
                    </span>
                    {p.protected_attribute && (
                      <span className="shrink-0 font-mono text-2xs text-muted hidden md:inline">
                        Δ{p.score.toFixed(2)}
                      </span>
                    )}
                    <span className="w-20 shrink-0 text-right font-mono text-2xs text-dim">{hhmmss(p.timestamp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
