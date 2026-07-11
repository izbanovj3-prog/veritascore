import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EXPO, SevBadge } from "../components/bits";
import { Radar } from "../components/Radar";
import { AGENTS, AUDIT_DONE_T, CERT, PROBE_STREAM, RADAR_AXES } from "../data";

const VISIBLE_ROWS = 16; // full findings log accumulates top-down

export function LiveAudit() {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(reduce ? AUDIT_DONE_T : 0);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const tick = (ts: number) => {
      const el = ts - start;
      setNow(el);
      if (el < AUDIT_DONE_T + 400) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const visible = PROBE_STREAM.filter((e) => e.t <= now);
  const rows = visible.slice(-VISIBLE_ROWS);
  const done = now >= AUDIT_DONE_T;
  const phase = done ? 6 : visible.length ? visible[visible.length - 1].phase : 0;
  const axesRevealed = visible.reduce((m, e) => (e.axis !== undefined ? Math.max(m, e.axis + 1) : m), 0);
  const progress = Math.min(1, now / AUDIT_DONE_T);
  const probesRun = Math.round(CERT.totalProbes * progress);
  const failures = Math.round(CERT.failedProbes * progress);
  const asr = (0.2 * progress).toFixed(2);

  return (
    <div className="slide s6">
      <motion.div
        className="noc"
        initial={{ opacity: 0, y: reduce ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EXPO }}
      >
        <div className="noc-head">
          <span className="rec-dot" aria-hidden="true" />
          <span className="t">LIVE AUDIT — {CERT.target}</span>
          <span className="url">ws://127.0.0.1:8000/ws/audit/{CERT.auditId}</span>
        </div>

        <div className="noc-body">
          {/* agent timeline */}
          <div className="tl" role="list" aria-label="Agent pipeline progress">
            {AGENTS.map((a, i) => {
              const state = i < phase ? "done" : i === phase && !done ? "running" : "pending";
              return (
                <div key={a.name} role="listitem" className={`tl-item ${state}`}>
                  <span className="num">{a.num}</span>
                  <span>{a.name}</span>
                  {state === "done" && <span className="mark">✓</span>}
                  {state === "running" && <span className="pulse-ring" aria-label="running" />}
                </div>
              );
            })}
          </div>

          {/* probe stream */}
          <div className="stream" aria-live="polite">
            {rows.map((e) => (
              <motion.div
                key={e.id}
                className="probe-row"
                initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EXPO }}
              >
                <span className="pt">{e.clock}</span>
                <span className="agent">{e.agent}</span>
                <span className="pid">{e.id}</span>
                <span className="msg">{e.msg}</span>
                <SevBadge sev={e.sev} />
              </motion.div>
            ))}
          </div>

          {/* telemetry */}
          <div className="telemetry">
            <div className="radar-wrap">
              <Radar axes={RADAR_AXES} mode="grow" reveal={axesRevealed} showThresholdLabel={false} />
            </div>
            <div className="counters">
              <div className="counter-cell">
                <div className="v">{probesRun}</div>
                <div className="k">PROBES</div>
              </div>
              <div className="counter-cell">
                <div className={failures > 0 ? "v bad" : "v"}>{failures}</div>
                <div className="k">FAILURES</div>
              </div>
              <div className="counter-cell">
                <div className={Number(asr) > 0.1 ? "v bad" : "v"}>{asr}</div>
                <div className="k">ASR</div>
              </div>
            </div>
            <p className="tele-note">
              Paired parity probing across six protected axes.{" "}
              <b>GENDER Δ0.53</b> exceeds the 0.25 threshold — flagged critical.
            </p>
          </div>
        </div>

        <div className="noc-foot">
          {done ? (
            <>
              <span className="ok">✓</span>
              <span>
                audit complete — {CERT.totalProbes} probes · {CERT.failedProbes} failures · compiling signed certificate →
              </span>
            </>
          ) : (
            <span>streaming · six agents · one MI300X · no external calls</span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
