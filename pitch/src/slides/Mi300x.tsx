import { motion, useReducedMotion } from "framer-motion";
import { CountUp, EXPO } from "../components/bits";

const SEGS = [
  { cls: "m1", w: 40, label: "TARGET LLM", sub: "the model under audit" },
  { cls: "m2", w: 25, label: "RED-TEAM LLM", sub: "generates attacks" },
  { cls: "m3", w: 8, label: "EMBED", sub: "similarity" },
  { cls: "m4", w: 27, label: "KV CACHE + HEADROOM", sub: "long-context probes" },
];

export function Mi300x() {
  const reduce = useReducedMotion();
  const ease = EXPO;
  const appear = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease },
  });

  return (
    <div className="slide s4">
      <motion.h2 {...appear(0.05)}>
        Why <em>MI300X</em>
      </motion.h2>

      <div className="s4-stat">
        <span className="big" aria-label="192 gigabytes HBM3">
          <CountUp to={192} duration={1.7} delay={0.35} />
        </span>
        <motion.div className="unit" {...appear(0.5)}>
          <span className="u1">GB HBM3</span>
          <span className="u2">on a single accelerator — enough to keep the entire audit loop resident</span>
        </motion.div>
      </div>

      <motion.div className="hbm" {...appear(0.7)}>
        <div className="hbm-label">
          <span>HBM3 RESIDENCY MAP</span>
          <span>0 ──── 192 GB</span>
        </div>
        <div className="hbm-bar">
          {SEGS.map((s, i) => (
            <div key={s.cls} className={`hbm-seg ${s.cls}`} style={{ width: `${s.w}%` }}>
              <motion.div
                className="fill"
                initial={{ scaleX: reduce ? 1 : 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 1.0 + i * 0.45, ease }}
              />
              <motion.span className="seg-label" {...appear(1.25 + i * 0.45)}>
                {s.label}
              </motion.span>
              <motion.span className="seg-sub" {...appear(1.35 + i * 0.45)}>
                {s.sub}
              </motion.span>
            </div>
          ))}
        </div>
        <motion.span className="hbm-resident" {...appear(2.9)}>
          ▰ ALL THREE MODELS RESIDENT SIMULTANEOUSLY — ZERO SWAPS, ZERO RELOADS
        </motion.span>
      </motion.div>

      <motion.div className="hbm-ghost" {...appear(3.3)}>
        <div className="hbm-label">
          <span>TYPICAL 80 GB CARD, SAME WORKLOAD</span>
        </div>
        <div className="ghost-bar">
          <span>one model at a time —</span>
          <em>swap → reload → swap → reload</em>
        </div>
      </motion.div>

      <motion.p className="bottom-line" {...appear(3.7)}>
        <strong>The full six-agent pipeline runs at interactive latency on one GPU.</strong>{" "}
        No cloud round-trips, no quantize-to-fit, and no prompt ever leaves the box.
      </motion.p>
    </div>
  );
}
