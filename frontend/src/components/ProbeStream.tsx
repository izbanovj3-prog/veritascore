import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAuditState } from "../context/AuditStreamContext";
import type { ProbeResultEvent } from "../types";

const FILTERS = ["all", "bias", "adversarial", "jailbreak", "drift"] as const;
type Filter = (typeof FILTERS)[number];

function isCritical(p: ProbeResultEvent): boolean {
  return !p.passed && p.severity === "critical";
}

function badgeClass(p: ProbeResultEvent): string {
  if (isCritical(p)) return "badge badge-crit";
  if (!p.passed) return "badge badge-fail";
  return "badge badge-pass";
}

function verdictLabel(p: ProbeResultEvent): string {
  if (isCritical(p)) return "CRITICAL";
  return p.passed ? "PASS" : "FAIL";
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
    estimateSize: () => 70,
    overscan: 10,
  });

  // follow the tail while the user is pinned to the bottom
  useEffect(() => {
    if (stick.current && filtered.length > 0) {
      virtualizer.scrollToIndex(filtered.length - 1, { align: "end" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length]);

  const items = virtualizer.getVirtualItems();

  const emptyMessage =
    connection === "closed"
      ? "Audit stream closed before the first probe."
      : connection === "reconnecting"
        ? "Reconnecting to the audit stream"
        : connection === "connecting"
          ? "Connecting to the audit stream"
          : "Waiting for the triage agent to begin probing";

  return (
    <section className="panel p-4 h-full flex flex-col" style={{ minHeight: 520 }} aria-label="Live probe stream">
      <div className="flex items-center justify-between mb-3">
        <h2 className="panel-title">Live probe stream</h2>
        <div className="flex gap-1" role="group" aria-label="Filter probes by category">
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={active}
                className="text-[10px] px-2 py-1 rounded"
                style={{
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  color: active ? "var(--accent)" : "var(--muted)",
                  background: active ? "oklch(0.84 0.14 200 / 0.08)" : "transparent",
                }}
              >
                {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="flex-1 flex items-center justify-center text-[12px] text-center px-6"
          style={{ color: "var(--muted)" }}
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
          className="flex-1 overflow-y-auto pr-1"
          role="log"
          aria-label="Probe results"
          aria-live="polite"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {items.map((vi) => {
              const p = filtered[vi.index];
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
                >
                  <div
                    className={`probe-in rounded-lg px-3 py-2 mb-1.5 ${isCritical(p) ? "row-crit" : ""}`}
                    style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={badgeClass(p)} aria-label={`${verdictLabel(p)} — probe ${p.probe_id}`}>
                        {verdictLabel(p)}
                      </span>
                      <span className="text-[11px] font-bold">{p.probe_id}</span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)" }}
                      >
                        {p.category}/{p.subcategory}
                      </span>
                      {p.synthetic && <span className="badge badge-syn">Synthesized</span>}
                      {p.protected_attribute && (
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                          {p.protected_attribute} · Δ{p.score.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                      {p.finding}
                    </div>
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
