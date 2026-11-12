# AGENTS.md

Instructions for AI agents and contributors working on the Aviation Situation Dashboard.

Read `INTENT.md` (why it exists and what to protect), `SPEC.md` (what it does), and `BACKLOG.md` (what is pending) before making changes. Update `SPEC.md` and `BACKLOG.md` when a change ships.

## Project at a glance

- One static page: `site/index.html` with inline CSS and JavaScript. No framework, no bundler, no build step.
- Everything Netlify serves lives in `site/` (the publish directory):
  - `_redirects`: Netlify reverse proxies.
  - `version.txt`: current version.
  - `manifest.json` and the icons.
- `netlify/functions/` holds server-side Netlify Functions (currently `atis.js`, the D-ATIS relay). Every deploy uploads them with `site/`; a deploy without them would remove them from the live site.
- Repo root holds the docs (`AGENTS.md`, `INTENT.md`, `SPEC.md`, `BACKLOG.md`, `README.md`), `tests/`, `package.json`, and `scripts/deploy.py`. Don't put served files at the root or docs inside `site/`.
- Hosted at https://aert2800wx.netlify.app (Netlify site `aert2800wx`).

## Working with the owner

- The owner is a retired air traffic controller and aviation professor. Use correct aviation terms and plain language.
- If the owner says "don't change anything" or "just wondering," answer the question only. Don't edit code or deploy.
- Ask before adding new features. Make requested changes exactly as described, and don't add extras.
- Keep summaries short: the version number, what changed, and anything the owner needs to do.
- **Backlog items are not approval.** When the owner says to check `BACKLOG.md`, read it, pick the item(s) the owner points to (or the most relevant if unspecified), and reply with a short proposal: what would change, where, the version number it would ship as, and any trade-offs or questions. Build only after the owner says yes to that proposal. Never deploy straight from the backlog.

## Rules

1. **Keep the safety disclaimers.** The "situational awareness only, not for official flight planning" warning must stay, word for word, in the briefing view and on the main page.
2. **Don't bring back removed features** unless the owner asks:
   - classroom tips or `classroomMode`
   - the VFR/IFR summary callout
   - the wind callouts
   - per-airport NOTAM links
   - SUA "May be active" text
   - the lightning sky flash
   - METAR color coding
3. **Weather logic reads only the METAR body.** Split at ` RMK ` before checking for TS, SN, RA, FZ, and similar codes. Remarks are never weather.
4. **Never hide missing data.** Keep the last good data, show the stale or outage banners, and keep every airport card visible.
5. **Use authoritative data as published.** Don't simplify, estimate, or redraw TFR polygons. Show raw METAR, TAF, and NOTAM text as issued.
6. **Load performance:**
   - METARs and TAFs load first, and NWS alerts are delayed.
   - Use the Netlify proxy paths in `_redirects` before any third-party proxy. To add a new upstream, add a `_redirects` rule.
7. **No autoplay.** The ATC pre-duty brief iframe is created only after a click.
8. **Classroom controls stay discreet:** fullscreen and briefing view are dimmed (55% opacity) and placed to the left of the theme toggle.
9. **Mobile Safari:**
   - Don't combine `position: sticky` with `overflow: hidden` on the header.
   - Don't size images with `height: 100%` inside flex or grid panes. Use absolute positioning inside a sized pane.
10. **Keep functions at the top level.** After any large edit, confirm the braces balance and that `fetchData`, `fetchAlerts`, `checkTFRs`, and `fetchWindsAloft` are still global.
11. **Script order.** The modals (`#briefModal`, `#lookupModal`, `#alertModal`, `#tfrModal`) sit after the inline `<script>`, so `document.getElementById` on them returns `null` while the script runs. Never attach a top-level listener to them — use an inline `on…` attribute or wire it inside a function. One such line threw at load and froze the page on "Loading data…" (v1.32 draft). `npm test` checks for this.
12. **Airport reference data comes from the FAA where possible.** Runway geometry is the FAA ADDS footprint layer; the `RUNWAYS` heading table is only the offline fallback and `npm test` checks it against the FAA fixture. Airport coordinates were checked against the FAA `US_Airport` layer in v1.36 (KDUH had been 8 nm off). When adding an airport, take lat/lon and runway headings from FAA data, not memory.
13. **Third-party data terms.** Follow each provider's published terms before shipping a feature that uses it. For ATIS Relay, the checklist in `BACKLOG.md` (1G0 AWOS item) is binding, and the KDTW D-ATIS panel already implements it (`netlify/functions/atis.js`, `atisBodyHtml`); keep the function's airport allow-list and 2-minute CDN cache when adding airports, and check the daily request budget (1,000 on the current plan): correct plan for public/school display, attribution link, the exact "Unofficial. Not for operational use. Confirm on frequency." notice, no suppressed warnings, ≤24 h cache with no archive, key server-side only, Phone Line Policy enforced in the function.
   While ATIS Relay data is on the dashboard, the site is for the owner's personal use only (see `INTENT.md`). Don't add classroom-facing features, share links, or QR codes that would show ATIS Relay data to others unless the owner confirms ATIS Relay's written permission.
14. **No secrets in the repo.** Netlify tokens and other credentials belong in a secure credential store. Never put them in code, commits, or docs.

## Versioning

- The format is `vMAJOR.MINOR`. Each deploy increases the second number (v1.30 → v1.31). The owner decides on major versions.
- On every release, update both `CURRENT_VERSION` in `index.html` and `version.txt` to the same value. The in-app update banner depends on it. The ATIS Relay `User-Agent` in `netlify/functions/atis.js` carries the same number (a static check enforces it).
- Small fixes made at the owner's request can keep the same version if the owner says so.

## Change workflow (required for every change)

1. Make the edit in `site/index.html`, along with `site/_redirects` and `site/version.txt` if needed.
2. Run `npm test` (static checks + unit tests, see `tests/README.md`). Fix failures before deploying. Add a test when you fix a parsing or math bug. Tests run only on command; do not add CI or schedules unless the owner asks.
3. Test locally or on a Netlify draft deploy. There should be no console errors, METARs and TAFs should load, and every tab should render.
4. Check the layout on a phone, iPad portrait and landscape, desktop, and a 1920×1080 projector.
5. **Deploy to Netlify** production with `scripts/deploy.py` (uploads `site/`; see `README.md`), then confirm the live `version.txt` shows the new version.
6. **Update the relevant docs** to match what shipped:
   - `SPEC.md`: what the app does now, including the version number at the top.
   - `BACKLOG.md`: remove items that shipped and add new ideas or open questions.
   - `INTENT.md`: new lasting decisions or principles.
   - `AGENTS.md`: new rules or lessons learned.
   - `README.md`: if the file list or deploy steps changed.
7. **Commit and push to GitHub** (`gettuph/asd`, branch `main`) with a message that names the version, for example "v1.31: Larger TAF text in briefing view".
8. Big visual features should be self-contained so they can be rolled back in one deploy.

The GitHub repo must always match what is live on Netlify. If a deploy fails, don't commit it as shipped.

## Known external issues (not bugs)

- AWC's API sometimes returns 204, empty, or slow responses. The app retries and shows the outage banner.
- aviationweather.gov blocks some cloud and datacenter IPs. Automated cloud browser tests may fail where classroom users won't.
- The airplanes.live map can be slow to load. That is on their end.
- Browsers can hold an old session after a deploy. The fix is to pull to refresh or hard-reload.
