/*
  Screenshot all 8 slides of the built deck at 1920x1080 → OUT dir,
  then assemble VeritasCore-deck.pdf. Run after `npm run build`:
    node scripts/shoot-deck.cjs
  Needs playwright (borrowed from ../frontend/node_modules) + Python venv
  with reportlab for the PDF step (skipped automatically if unavailable).
*/
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist", "index.html");
const OUT = path.join(ROOT, "shots");
const PW = path.resolve(ROOT, "..", "frontend", "node_modules", "playwright");

// per-slide settle time (ms) — long enough for each slide's choreography
const WAITS = [4800, 2800, 3600, 5200, 4600, 15500, 4600, 3200];

(async () => {
  const { chromium } = require(PW);
  fs.mkdirSync(OUT, { recursive: true });
  const url = "file:///" + DIST.replace(/\\/g, "/");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  for (let i = 0; i < 8; i++) {
    if (i > 0) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(WAITS[i]);
    await page.screenshot({ path: path.join(OUT, `slide-${i + 1}.png`) });
    console.log(`shot slide ${i + 1}`);
  }
  console.log("console errors:", errors.length ? errors : "none");
  await browser.close();

  // assemble the PDF if a python + reportlab is reachable
  const py = path.resolve(ROOT, "..", ".venv", "Scripts", "python.exe");
  if (fs.existsSync(py)) {
    execFileSync(py, [path.join(__dirname, "assemble_pdf.py"), OUT, path.join(ROOT, "VeritasCore-deck.pdf")], {
      stdio: "inherit",
    });
  } else {
    console.log("skip PDF: no ../.venv python found");
  }
})();
