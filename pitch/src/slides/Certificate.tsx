import { motion, useReducedMotion } from "framer-motion";
import { CountUp, EXPO } from "../components/bits";
import { CERT, CLAUSES } from "../data";

export function Certificate() {
  const reduce = useReducedMotion();
  const ease = EXPO;
  const appear = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease },
  });

  return (
    <div className="slide s7">
      <motion.div
        className="cert"
        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
      >
        <div className="cert-hatch l" aria-hidden="true" />
        <div className="cert-hatch r" aria-hidden="true" />

        <div className="cert-head">
          <h2>Compliance Audit Certificate</h2>
          <div className="cert-meta">
            AUDIT <b>{CERT.auditId}</b> · <b>{CERT.timestamp}</b>
            <br />
            TARGET <b>{CERT.target}</b> · {CERT.totalProbes} PROBES · {CERT.failedProbes} FAILED
          </div>
        </div>

        <div className="cert-score">
          <span className="score">
            <CountUp to={CERT.score} decimals={2} duration={2.1} delay={0.4} />
          </span>
          <span className="of">/ 100</span>
          <motion.span
            className="stamp"
            initial={{ opacity: 0, scale: reduce ? 1 : 1.7, rotate: reduce ? -5 : -14 }}
            animate={{ opacity: 1, scale: 1, rotate: -5 }}
            transition={{ duration: 0.4, delay: 2.4, ease }}
          >
            {CERT.status}
          </motion.span>
          <motion.span className="verdict-note" {...appear(2.7)}>
            Below the 70-point compliance floor. This target does not ship.
          </motion.span>
        </div>

        <div className="cert-grid">
          <motion.table className="cert-tbl" {...appear(1.0)}>
            <caption>FINDINGS BY CATEGORY</caption>
            <thead>
              <tr>
                <th scope="col">CATEGORY</th>
                <th scope="col">PROBES</th>
                <th scope="col">FAILED</th>
                <th scope="col">CRITICAL</th>
              </tr>
            </thead>
            <tbody>
              {CERT.findings.map((f) => (
                <tr key={f.category}>
                  <td>{f.category}</td>
                  <td>{f.total}</td>
                  <td className={f.failed > 0 ? "bad" : undefined}>{f.failed}</td>
                  <td className={f.critical > 0 ? "bad" : undefined}>{f.critical}</td>
                </tr>
              ))}
            </tbody>
          </motion.table>

          <div className="clauses">
            <motion.span className="clauses-cap" {...appear(1.2)}>
              MAPPED CLAUSES
            </motion.span>
            {CLAUSES.map((c, i) => (
              <motion.div key={c.ref} className={`clause ${c.kind}`} {...appear(1.35 + i * 0.14)}>
                <span className="ref">{c.ref}</span>
                <span className="what">{c.what}</span>
              </motion.div>
            ))}
            <motion.span className="disclaimer" {...appear(2.3)}>
              Clause mapping is illustrative, not legal advice.
            </motion.span>
          </div>
        </div>

        <motion.div className="cert-sig" {...appear(2.9)}>
          <div className="sig-check">
            <svg viewBox="0 0 26 26" aria-hidden="true">
              <circle cx="13" cy="13" r="12" fill="none" stroke="var(--success)" strokeWidth="1.4" />
              <motion.path
                d="M 7.5 13.5 L 11.5 17.5 L 18.5 9.5"
                fill="none"
                stroke="var(--success)"
                strokeWidth="2"
                strokeLinecap="square"
                initial={{ pathLength: reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 3.2, ease }}
              />
            </svg>
            <span className="lbl">Ed25519 SIGNATURE VERIFIED</span>
          </div>
          <div className="sig-hex">
            <b>sig</b> {CERT.signature}
            <br />
            <b>key</b> {CERT.fingerprint}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
