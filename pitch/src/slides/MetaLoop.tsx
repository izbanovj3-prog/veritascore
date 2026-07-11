import { motion, useReducedMotion } from "framer-motion";
import { EXPO, TypeLine } from "../components/bits";

const CX = 210;
const CY = 210;
const R = 140;

const pt = (deg: number, r = R): [number, number] => [
  CX + r * Math.cos((deg * Math.PI) / 180),
  CY + r * Math.sin((deg * Math.PI) / 180),
];

const arc = (a1: number, a2: number) => {
  const [x1, y1] = pt(a1);
  const [x2, y2] = pt(a2);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};

const STEPS = [
  { deg: -90, num: "1", label: "RUN", lx: 0, ly: -52, anchor: "middle" },
  { deg: 0, num: "2", label: "MEASURE DECAY", lx: 44, ly: 4, anchor: "start" },
  { deg: 90, num: "3", label: "SYNTHESIZE", lx: 0, ly: 62, anchor: "middle" },
  { deg: 180, num: "4", label: "RE-RUN", lx: -44, ly: 4, anchor: "end" },
] as const;

export function MetaLoop() {
  const reduce = useReducedMotion();
  const ease = EXPO;
  const appear = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease },
  });

  return (
    <div className="slide s5">
      <div className="s5-left">
        <motion.h2 {...appear(0.05)}>
          The system audits <em>its own probes</em>.
        </motion.h2>
        <motion.p className="lede" {...appear(0.35)}>
          Static eval suites decay — the model changes, coverage rots.{" "}
          <strong>VeritasCore's meta-agent measures whether each probe family is
          still finding failures.</strong>{" "}
          When effectiveness drops below threshold, it synthesizes new
          adversarial cases from the failures it just observed and re-runs the
          expanded set. Coverage never goes stale.
        </motion.p>
        <motion.div className="term" {...appear(0.7)} aria-live="polite">
          <span className="prompt-tag">meta-agent │ </span>
          <TypeLine
            text="effectiveness 0.38 < 0.40 — synthesized 9 new probes from 3 failure clusters. re-running expanded coverage."
            delay={1.4}
            cps={38}
            cursor
          />
        </motion.div>
      </div>

      <div className="s5-right loop-figure">
        <svg viewBox="0 0 420 420" aria-label="Self-evolving probe loop: run, measure decay, synthesize, re-run">
          <defs>
            <marker id="loop-arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--accent)" />
            </marker>
          </defs>

          {/* orbiting comet — under the nodes so it slides beneath them */}
          {!reduce && (
            <motion.g
              style={{ transformOrigin: `${CX}px ${CY}px` }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, ease: "linear", duration: 9, delay: 2 }}
            >
              <circle cx={CX} cy={CY - R} r="8" fill="var(--accent)" opacity="0.18" />
              <circle cx={CX} cy={CY - R} r="3.5" fill="var(--accent)" />
            </motion.g>
          )}

          {/* four arcs, drawing in sequence */}
          {STEPS.map((s, i) => (
            <motion.path
              key={s.label}
              d={arc(s.deg + 13, s.deg + 77)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.6"
              markerEnd="url(#loop-arr)"
              initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 + i * 0.35, ease }}
            />
          ))}

          {/* step nodes */}
          {STEPS.map((s, i) => {
            const [x, y] = pt(s.deg);
            return (
              <motion.g key={s.num} {...appear(0.35 + i * 0.35)}>
                <circle cx={x} cy={y} r="24" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
                <text x={x} y={y + 5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="15" fontWeight="700" fill="var(--accent)">
                  {s.num}
                </text>
                <text
                  x={x + s.lx}
                  y={y + s.ly}
                  textAnchor={s.anchor}
                  fontFamily="var(--font-mono)"
                  fontSize="13"
                  letterSpacing="0.08em"
                  fill="var(--text)"
                >
                  {s.label}
                </text>
              </motion.g>
            );
          })}

          {/* center caption */}
          <motion.text
            x={CX}
            y={CY - 4}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="11"
            fill="var(--muted)"
            {...appear(1.8)}
          >
            PROBE LIBRARY
          </motion.text>
          <motion.text
            x={CX}
            y={CY + 14}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="11"
            fill="var(--accent)"
            {...appear(1.9)}
          >
            EVOLVING
          </motion.text>
        </svg>
      </div>
    </div>
  );
}
