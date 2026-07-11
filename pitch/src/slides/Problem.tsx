import { motion } from "framer-motion";
import { EXPO } from "../components/bits";
import { PROBLEM_ROWS } from "../data";

export function Problem() {
  return (
    <div className="slide s2">
      <motion.h2
        className="statement"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: EXPO }}
      >
        A model that passes review today{" "}
        <em>drifts into non&#8209;compliance</em> next week.
      </motion.h2>
      <div className="ledger">
        {PROBLEM_ROWS.map((row, i) => (
          <motion.div
            key={row.token}
            className="ledger-row"
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.65 + i * 0.22, ease: EXPO }}
          >
            <span className="token">{row.token}</span>
            <span className="name">{row.name}</span>
            <span className="desc">{row.desc}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
