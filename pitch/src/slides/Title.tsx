import { motion } from "framer-motion";
import { Brackets, EXPO } from "../components/bits";
import { Radar } from "../components/Radar";
import { RADAR_AXES } from "../data";

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EXPO },
});

const CHIPS: Array<[string, boolean]> = [
  ["MI300X", true],
  ["ROCm", true],
  ["vLLM", true],
  ["LangGraph", false],
  ["FastAPI", false],
  ["Ed25519", false],
];

export function Title() {
  return (
    <div className="slide s1">
      <Brackets delay={0.15} />
      <div className="s1-left">
        <motion.p className="kicker" {...rise(0.1)}>
          AMD DEVELOPER HACKATHON · ACT II · UNICORN TRACK
        </motion.p>
        <motion.h1 className="hero" {...rise(0.25)}>
          Veritas<em>Core</em>
        </motion.h1>
        <motion.p className="sub" {...rise(0.45)}>
          Real-time <strong>behavioral auditing</strong> for deployed AI models — six
          autonomous agents red-teaming continuously,{" "}
          <strong>entirely on one AMD Instinct MI300X</strong>. No external
          inference API. Nothing leaves the GPU.
        </motion.p>
        <div className="chips">
          {CHIPS.map(([label, hot], i) => (
            <motion.span
              key={label}
              className={hot ? "chip hot" : "chip"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 + i * 0.08, ease: EXPO }}
            >
              {label}
            </motion.span>
          ))}
        </div>
      </div>
      <motion.div
        className="s1-right"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <Radar axes={RADAR_AXES} mode="draw" delay={0.8} />
      </motion.div>
    </div>
  );
}
