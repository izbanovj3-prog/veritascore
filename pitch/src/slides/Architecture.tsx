import { motion, useReducedMotion } from "framer-motion";
import { EXPO } from "../components/bits";
import { AGENTS } from "../data";

const NODE_W = 150;
const NODE_H = 64;
const NODE_Y = 90;
const EDGE_Y = NODE_Y + NODE_H / 2;
const XS = [20, 200, 380, 560, 740, 920];

export function Architecture() {
  const reduce = useReducedMotion();
  const ease = EXPO;
  const draw = (delay: number) => ({
    initial: { pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.5, delay, ease },
  });
  const appear = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease },
  });

  return (
    <div className="slide s3">
      <motion.h2 {...appear(0.05)}>
        Six autonomous agents. One MI300X. <em>Zero API calls.</em>
      </motion.h2>

      <div className="pipeline">
        <svg viewBox="0 0 1260 208" aria-label="Six-agent LangGraph pipeline ending in a signed certificate">
          <defs>
            <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--accent)" />
            </marker>
            <marker id="arr-dim" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--muted)" />
            </marker>
          </defs>

          {/* meta loop-back: synthesized probes re-enter the queue */}
          <motion.path
            d={`M ${XS[5] + 75} ${NODE_Y - 4} C ${XS[5] + 75} 22, ${XS[2] + 75} 22, ${XS[2] + 75} ${NODE_Y - 6}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.6"
            strokeDasharray="6 5"
            markerEnd="url(#arr)"
            {...draw(1.9)}
          />
          <motion.text
            x={(XS[2] + XS[5]) / 2 + 75}
            y="16"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="11.5"
            fill="var(--accent)"
            {...appear(2.2)}
          >
            synthesized probes re-enter the queue
          </motion.text>

          {/* agent nodes + roles */}
          {AGENTS.map((a, i) => (
            <motion.g key={a.name} {...appear(0.25 + i * 0.16)}>
              <rect
                x={XS[i]}
                y={NODE_Y}
                width={NODE_W}
                height={NODE_H}
                fill="var(--surface)"
                stroke={i === 5 ? "var(--accent-border)" : "var(--border)"}
                strokeWidth="1"
              />
              <text
                x={XS[i] + 12}
                y={NODE_Y + 24}
                fontFamily="var(--font-mono)"
                fontSize="10"
                fill="var(--accent)"
              >
                {a.num}
              </text>
              <text
                x={XS[i] + 12}
                y={NODE_Y + 45}
                fontFamily="var(--font-mono)"
                fontSize="14.5"
                fontWeight="700"
                fill="var(--text-bright)"
                letterSpacing="0.04em"
              >
                {a.name}
              </text>
              <text
                x={XS[i] + NODE_W / 2}
                y={NODE_Y + NODE_H + 24}
                textAnchor="middle"
                fontFamily="var(--font-body)"
                fontSize="11.5"
                fill="var(--muted)"
              >
                {a.role}
              </text>
            </motion.g>
          ))}

          {/* forward edges */}
          {XS.slice(0, -1).map((x, i) => (
            <motion.line
              key={i}
              x1={x + NODE_W}
              y1={EDGE_Y}
              x2={XS[i + 1] - 2}
              y2={EDGE_Y}
              stroke="var(--muted)"
              strokeWidth="1.4"
              markerEnd="url(#arr-dim)"
              {...draw(0.5 + i * 0.16)}
            />
          ))}

          {/* output: signed certificate */}
          <motion.line
            x1={XS[5] + NODE_W}
            y1={EDGE_Y}
            x2={1102}
            y2={EDGE_Y}
            stroke="var(--accent)"
            strokeWidth="1.4"
            markerEnd="url(#arr)"
            {...draw(1.5)}
          />
          <motion.g {...appear(1.65)}>
            <rect x={1106} y={NODE_Y + 8} width={148} height={48} fill="var(--accent-dim)" stroke="var(--accent-border)" strokeWidth="1" />
            <text x={1180} y={NODE_Y + 28} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11.5" fontWeight="700" fill="var(--accent)">
              SIGNED CERT
            </text>
            <text x={1180} y={NODE_Y + 44} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--muted)">
              Ed25519
            </text>
          </motion.g>
        </svg>
      </div>

      <motion.p className="substrate" {...appear(2.5)}>
        <span>
          <b>LangGraph StateGraph</b> — one shared audit state · agents append findings · meta rewrites the probe queue
        </span>
      </motion.p>
    </div>
  );
}
