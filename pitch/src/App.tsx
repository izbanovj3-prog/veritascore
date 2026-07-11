import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { EXPO } from "./components/bits";
import { SLIDE_META } from "./data";
import { Title } from "./slides/Title";
import { Problem } from "./slides/Problem";
import { Architecture } from "./slides/Architecture";
import { Mi300x } from "./slides/Mi300x";
import { MetaLoop } from "./slides/MetaLoop";
import { LiveAudit } from "./slides/LiveAudit";
import { Certificate } from "./slides/Certificate";
import { Close } from "./slides/Close";

const SLIDES = [Title, Problem, Architecture, Mi300x, MetaLoop, LiveAudit, Certificate, Close];
const N = SLIDES.length;

export default function App() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [overview, setOverview] = useState(false);

  const go = useCallback((n: number) => {
    setIndex(Math.max(0, Math.min(N - 1, n)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          e.preventDefault();
          if (!overview) go(index + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          if (!overview) go(index - 1);
          break;
        case "Home":
          go(0);
          break;
        case "End":
          go(N - 1);
          break;
        case "Escape":
          setOverview((v) => !v);
          break;
        default:
          if (/^[1-8]$/.test(e.key)) {
            go(Number(e.key) - 1);
            setOverview(false);
          }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, overview, go]);

  const Slide = SLIDES[index];
  const meta = SLIDE_META[index];

  return (
    <MotionConfig reducedMotion="user">
      <main className="deck" onClick={() => !overview && go(index + 1)} aria-label="VeritasCore pitch deck">
        <header className="chrome-top" aria-hidden="true">
          <span className="wordmark">
            VERITAS<b>CORE</b>
          </span>
          <span>
            {meta.code} · {meta.title.toUpperCase()}
          </span>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            style={{ position: "absolute", inset: 0 }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0 100% 0 0)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, clipPath: "inset(0 0% 0 0)" }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            transition={{ duration: 0.5, ease: EXPO }}
          >
            <Slide />
          </motion.div>
        </AnimatePresence>

        <nav className="chrome-bottom" aria-label="Slide navigation">
          <span className="counter">
            {String(index + 1).padStart(2, "0")} ∕ {String(N).padStart(2, "0")}
          </span>
          <div className="progress">
            {SLIDE_META.map((m, i) => (
              <button
                key={m.code}
                aria-label={`Slide ${i + 1} — ${m.title}`}
                aria-current={i === index}
                className={i === index ? "active" : i < index ? "done" : ""}
                onClick={(e) => {
                  e.stopPropagation();
                  go(i);
                }}
              >
                <span />
              </button>
            ))}
          </div>
        </nav>
        <span className="chrome-hint" aria-hidden="true">
          ←→ NAVIGATE · ESC OVERVIEW
        </span>

        <AnimatePresence>
          {overview && (
            <motion.div
              className="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>DECK OVERVIEW — CLICK TO JUMP · ESC TO CLOSE</h3>
              <div className="ov-grid">
                {SLIDE_META.map((m, i) => (
                  <motion.button
                    key={m.code}
                    className={`ov-tile${i === index ? " current" : ""}`}
                    initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.04, ease: EXPO }}
                    onClick={() => {
                      go(i);
                      setOverview(false);
                    }}
                  >
                    <span className="n">{m.code}</span>
                    <span className="t">{m.title}</span>
                    <span className="d">{m.desc}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}
