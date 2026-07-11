import { motion, useReducedMotion } from "framer-motion";
import { Brackets, EXPO } from "../components/bits";
import { STACK_ROWS } from "../data";

export function Close() {
  const reduce = useReducedMotion();
  const ease = EXPO;
  const appear = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease },
  });

  return (
    <div className="slide s8">
      <Brackets delay={2.2} />
      <div className="stack">
        {STACK_ROWS.map((row, i) => (
          <motion.div
            key={row.layer}
            className="stack-row"
            initial={{ opacity: 0, x: reduce ? 0 : -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.15 + i * 0.16, ease }}
          >
            <span className="layer">{row.layer}</span>
            <span className="items">
              {row.items.map((item, j) => (
                <span key={item}>
                  {j > 0 && " · "}
                  {j === 0 ? <b>{item}</b> : item}
                </span>
              ))}
            </span>
            <span className="note">{row.note}</span>
          </motion.div>
        ))}
      </div>

      <motion.p className="close-line" {...appear(1.3)}>
        VeritasCore — auditing AI, <em>continuously</em>, without ever leaving
        the GPU.
      </motion.p>

      <motion.div className="footer-links" {...appear(1.8)}>
        <span>
          <b>github.com/izbanovj3-prog/veritascore</b>
        </span>
        <span>live demo · izbanovj3-prog.github.io/veritascore</span>
        <span>verify offline · Ed25519 public key in repo</span>
      </motion.div>
    </div>
  );
}
