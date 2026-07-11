# VeritasCore — Audit Deck

Interactive, animated pitch presentation for the AMD Developer Hackathon
Act II (Unicorn Track). A React SPA styled as a mission-critical security
terminal, sharing the visual language of the VeritasCore product dashboard.
All certificate data on slide 7 (score, signature, fingerprint, findings)
is copied verbatim from the real Ed25519-signed artifact
`../frontend/public/demo/certificate.json`.

## Run it

```
npm install
npm run dev        # http://localhost:5199
```

Or present without any server: `npm run build` produces **one self-contained
file** — `dist/index.html` (~1.2 MB, fonts inlined). Double-click it, put it
on a USB stick, or host it anywhere. No network needed at the venue.

## Static PDF export

`VeritasCore-deck.pdf` (8 pages, 16:9, ~2 MB) is a flat export of every slide
at its fully-revealed final state — for emailing, printing, or projecting
where you can't run the browser. It has no animation; the live deck above is
the real thing. To regenerate after editing slides:
`node scripts/shoot-deck.cjs` (screenshots) then rebuild the PDF.

## Presenting — controls

| Key | Action |
| --- | --- |
| `→` `↓` `Space` `PgDn` / click | next slide |
| `←` `↑` `PgUp` | previous slide |
| `1`–`8` | jump to slide |
| `Esc` | overview grid (click a tile to jump) |
| `Home` / `End` | first / last slide |

The progress bar segments at the bottom are also clickable.

## Slides

1. **Title** — radar draws itself; gender axis flagged Δ0.53
2. **The Problem** — four failure modes of today's AI audits
3. **Architecture** — six LangGraph agents; meta loop-back edge
4. **Why MI300X** — 192 GB HBM3 residency map, three models resident
5. **Self-Evolving Probes** — run → measure decay → synthesize → re-run
6. **Live Audit** — simulated probe stream (~13 s choreography); re-enter the
   slide (`←` then `→`) to replay it
7. **The Certificate** — real signed verdict: 23.35 / 100, FAIL
8. **Stack & Close**

Every animation has a `prefers-reduced-motion` fallback (final states render
instantly). All colors live in `src/tokens.css`.
