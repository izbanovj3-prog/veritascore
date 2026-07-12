// VeritasCore end-to-end demo audit — Playwright.
//   node tests/audit.e2e.mjs
// Requires: frontend dev server :5173, backend :8000, demo target :8001.
import { chromium } from "playwright";
import { createRequire } from "module";
import { readFileSync, mkdirSync } from "fs";
import os from "os";
import path from "path";

const require = createRequire(import.meta.url);
const AXE_SRC = readFileSync(require.resolve("axe-core"), "utf8");

const BASE = process.env.VC_BASE || "http://localhost:5173";
const TARGET = process.env.VC_TARGET || "http://localhost:8001/v1/respond";
const SHOT_DIR = process.env.VC_SHOT_DIR || path.join(os.tmpdir(), "vc-shots");
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
  return !!ok;
}
const shot = (page, file) => page.screenshot({ path: path.join(SHOT_DIR, file), animations: "disabled" });

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // ---------------- TEST 1 — initial load ----------------
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 8000 });
    const h1 = (await page.textContent("h1")) || "";
    check("T1 launcher visible", /Audit Launcher/i.test(h1), h1.trim());
    const focused = await page.evaluate(() => document.activeElement?.id);
    check("T1 URL input focused", focused === "target-url", `activeElement=#${focused}`);
    await page.waitForTimeout(300);
    check("T1 no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
    await shot(page, "vc-01-initial.png");
  } catch (e) {
    check("T1 initial load", false, String(e));
  }

  // ---------------- TEST 2 — launch an audit ----------------
  try {
    await page.fill("#target-url", TARGET);
    const t0 = Date.now();
    await page.click('button[type="submit"]');
    // responsive within 200ms: either the button enters its busy state or we navigate
    let responsive = false;
    for (let i = 0; i < 8 && !responsive; i++) {
      const btn = (await page.textContent('button[type="submit"]').catch(() => "")) || "";
      if (/Launching/.test(btn) || page.url().includes("/audit/")) responsive = true;
      else await page.waitForTimeout(25);
    }
    check("T2 launch responsive <200ms", responsive, `${Date.now() - t0}ms`);
    await page.waitForURL("**/audit/**", { timeout: 4000 });
    check("T2 audit_id in URL <2s", /\/audit\/[0-9a-f]{6,}/.test(page.url()), page.url());
    await page.waitForSelector('ol[aria-label="Audit agent pipeline"]', { timeout: 4000 });
    const phases = await page.locator('ol[aria-label="Audit agent pipeline"] > li').count();
    check("T2 timeline shows 7 phases", phases === 7, `count=${phases}`);
    let active = false;
    for (let i = 0; i < 30 && !active; i++) {
      active = await page.evaluate(() =>
        [...document.querySelectorAll('ol[aria-label="Audit agent pipeline"] > li')].some((li) =>
          /: (running|done)/.test(li.getAttribute("aria-label") || "")
        )
      );
      if (!active) await page.waitForTimeout(200);
    }
    check("T2 a phase is running/done", active);
    await shot(page, "vc-02-launched.png");
  } catch (e) {
    check("T2 launch audit", false, String(e));
  }

  // ---------------- TEST 3 — WebSocket stream ----------------
  try {
    // Probe rows only appear via probe_result frames pushed over the WebSocket,
    // so their arrival is itself proof the live stream is flowing.
    let badges = 0;
    for (let i = 0; i < 50 && badges < 1; i++) {
      badges = await page.locator(".probe-badge").count();
      if (!badges) await page.waitForTimeout(300);
    }
    check("T3 probe results visible", badges >= 1, `badges=${badges}`);
    const firstBadge = (await page.locator(".probe-badge").first().textContent()) || "";
    check("T3 probe has verdict badge", /PASS|FAIL|CRITICAL/.test(firstBadge), firstBadge);

    // WS is load-bearing: assert the count GROWS over time (streaming, not a
    // single batch) — the demo replays frames on their original schedule.
    const c1 = await page.locator(".probe-badge").count();
    await page.waitForTimeout(1500);
    const c2 = await page.locator(".probe-badge").count();
    check("T3 stream delivers frames incrementally", c2 > c1, `t0=${c1} t+1.5s=${c2}`);

    // BiasRadar is now a hand-drawn SVG (no Recharts). It must render a value
    // polygon, never a blank shell — even before all bias probes complete.
    const radar = await page.evaluate(() => {
      const svg = document.querySelector('section[aria-label="Bias disparity radar"] svg');
      return { paths: svg ? svg.querySelectorAll("path").length : 0 };
    });
    check("T3 BiasRadar renders (never empty)", radar.paths > 0, `svg paths=${radar.paths}`);

    // The bias_update frame must flag the gender axis with its Δ annotation.
    let genderFlag = "";
    for (let i = 0; i < 40 && !genderFlag; i++) {
      genderFlag = await page.evaluate(() => {
        const t = [...document.querySelectorAll('section[aria-label="Bias disparity radar"] text')].find((n) =>
          /GENDER\s+Δ/i.test(n.textContent || "")
        );
        return t ? t.textContent.trim() : "";
      });
      if (!genderFlag) await page.waitForTimeout(300);
    }
    check("T3 bias_update flags GENDER axis on radar", /GENDER\s+Δ0\.\d/.test(genderFlag), genderFlag);

    // Finding text (item 3): the old defect was one generic adversarial
    // sentence repeated 5-6x consecutively. Assert no finding repeats more than
    // twice in a row. (A run of 2 is legitimate: bias probes are PAIRED, so a
    // pair's two mirrored members share the same disparity finding by design.)
    // Let enough of the stream arrive to include adversarial rows.
    await page.waitForTimeout(2500);
    const findings = await page.evaluate(() =>
      [...document.querySelectorAll('[role="log"] .probe-in')]
        .map((r) => r.querySelector("span[title]")?.getAttribute("title") || "")
        .filter(Boolean)
    );
    let maxRun = findings.length ? 1 : 0;
    let run = 1;
    for (let i = 1; i < findings.length; i++) {
      run = findings[i] === findings[i - 1] ? run + 1 : 1;
      if (run > maxRun) maxRun = run;
    }
    check(
      "T3 no finding repeated >2x consecutively (item 3)",
      findings.length >= 6 && maxRun <= 2,
      `rows=${findings.length} maxConsecutiveRepeat=${maxRun}`
    );

    await shot(page, "vc-03-streaming.png");
  } catch (e) {
    check("T3 websocket stream", false, String(e));
  }

  // ---------------- TEST 4 — probe stream behavior ----------------
  try {
    const log = page.locator('[role="log"][aria-label="Probe results"]');
    await log.waitFor({ timeout: 4000 });
    // Drop the completion modal FIRST if the audit already finished: its
    // self-focus can perturb the underlying scroll and make these checks racy.
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (d && d.parentElement) d.parentElement.remove();
    });
    // The scroll-behaviour checks are only meaningful once the log actually
    // overflows its container (enough rows to scroll). Wait for that first.
    let scrollable = false;
    for (let i = 0; i < 48 && !scrollable; i++) {
      scrollable = await log.evaluate((el) => el.scrollHeight - el.clientHeight > 300);
      if (!scrollable) await page.waitForTimeout(250);
    }
    check("T4 probe log overflows (scrollable)", scrollable);
    // re-drop the completion modal in case the audit finished while we waited
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (d && d.parentElement) d.parentElement.remove();
    });
    // auto-follow: container is pinned near the bottom
    await page.waitForTimeout(400);
    const nearBottom = await log.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop < 80);
    check("T4 auto-scroll follows tail", nearBottom);
    // scroll up manually -> auto-scroll must not snap the view back to the bottom.
    // A human holds position by scrolling repeatedly; do the same so the test
    // isn't racing a single pending scrollToIndex rAF. Then assert the view is
    // not pinned to the bottom (the semantic of "auto-follow paused").
    for (let i = 0; i < 6; i++) {
      await log.evaluate((el) => (el.scrollTop = 0));
      await page.waitForTimeout(200);
    }
    const distFromBottom = await log.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
    check("T4 auto-scroll pauses on manual scroll", distFromBottom > 200, `distFromBottom=${distFromBottom}`);
    // filter to bias
    await page.getByRole("button", { name: "bias", exact: true }).click();
    const biasPressed = await page.getByRole("button", { name: "bias", exact: true }).getAttribute("aria-pressed");
    const biasRows = await page.evaluate(() => {
      const tags = [...document.querySelectorAll('[role="log"][aria-label="Probe results"] span')]
        .map((s) => s.textContent || "")
        .filter((t) => /^(bias|adversarial|jailbreak|drift)\//.test(t));
      return { count: tags.length, allBias: tags.length > 0 && tags.every((t) => t.startsWith("bias")) };
    });
    check("T4 Bias filter active + only bias rows", biasPressed === "true" && biasRows.allBias, `pressed=${biasPressed} rows=${biasRows.count}`);
    await page.getByRole("button", { name: "all", exact: true }).click();
    const allPressed = await page.getByRole("button", { name: "all", exact: true }).getAttribute("aria-pressed");
    check("T4 all filter restores", allPressed === "true");
    await shot(page, "vc-04-probestream.png");
  } catch (e) {
    check("T4 probe stream behavior", false, String(e));
  }

  // ---------------- TEST 6 — accessibility (run before nav away) ----------------
  try {
    // ensure background dashboard is scannable: drop any open modal overlay
    await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      if (dlg && dlg.parentElement) dlg.parentElement.remove();
    });
    const badgeInfo = await page.evaluate(() => {
      const b = [...document.querySelectorAll(".probe-badge")];
      return { count: b.length, allLabeled: b.length > 0 && b.every((x) => !!x.getAttribute("aria-label")) };
    });
    check("T6 severity badges have aria-label", badgeInfo.allLabeled, `count=${badgeInfo.count}`);
    const phasesLabeled = await page.evaluate(() =>
      [...document.querySelectorAll('ol[aria-label="Audit agent pipeline"] > li')].every((li) => !!li.getAttribute("aria-label"))
    );
    check("T6 timeline phases announced", phasesLabeled);
    const tabReachable = await page.evaluate(() => {
      const f = document.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
      return f.length;
    });
    check("T6 interactive elements tabbable", tabReachable > 0, `focusable=${tabReachable}`);
    await page.addScriptTag({ content: AXE_SRC });
    const axe = await page.evaluate(async () =>
      await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } })
    );
    const critical = axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    check(
      "T6 no critical/serious a11y violations",
      critical.length === 0,
      critical.map((v) => `${v.id}(${v.impact})`).join(", ")
    );
  } catch (e) {
    check("T6 accessibility", false, String(e));
  }

  // ---------------- TEST 5 — responsive (separate context) ----------------
  try {
    const mctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mp = await mctx.newPage();
    await mp.goto(BASE, { waitUntil: "domcontentloaded" });
    await mp.waitForSelector("h1");
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check("T5 no horizontal overflow (mobile)", overflow <= 1, `overflowPx=${overflow}`);
    const usable = (await mp.locator("#target-url").isVisible()) && (await mp.getByRole("button", { name: "Launch audit" }).isVisible());
    check("T5 launcher usable (mobile)", usable);
    await shot(mp, "vc-05-mobile.png");
    await mp.setViewportSize({ width: 1920, height: 1080 });
    await mp.waitForTimeout(150);
    await shot(mp, "vc-06-desktop-full.png");
    await mctx.close();
  } catch (e) {
    check("T5 responsive", false, String(e));
  }

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n==== ${passed}/${results.length} checks passed ====`);
  console.log(`screenshots: ${SHOT_DIR}`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log("FAILURES:");
    failed.forEach((f) => console.log(`  - ${f.name} :: ${f.detail}`));
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
