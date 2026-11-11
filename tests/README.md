# Tests

Run on demand; nothing is scheduled and there is no CI workflow.

```sh
npm test               # static checks, then unit tests
npm run test:static    # node tests/static-checks.js
npm run test:unit      # node --test tests/*.test.js
```

Requires Node 20+. No dependencies to install.

## What is covered

**`static-checks.js`** reads `site/index.html`, `site/_redirects`, `site/version.txt`, and `site/manifest.json` and verifies:
- the inline script parses;
- `CURRENT_VERSION`, `<title>`, the header label, and `version.txt` all agree;
- both safety disclaimers are present word for word, and the briefing view's is first;
- removed features stay removed (classroom tips, sky flash, callouts, NOTAM links);
- no autoplay: no CAVU iframe in static HTML, the load button exists;
- header control order and dimming;
- Mobile Safari rules (no sticky+overflow on `.header`, briefing images absolutely positioned, zero-minimum grid tracks, `max-content` rows);
- weather detection splits at ` RMK `; no `rawBody` typo;
- every `getElementById` target exists in the HTML (or is in the known dynamic list);
- every top-level `addEventListener` target appears in the HTML before the `<script>` (elements after it are `null` at load);
- airport lookup: modal exists with the disclaimer, repeats the text box and Go, fetches only on submit, blocks pull-to-refresh;
- `_redirects` keeps the `?` before `:splat` on AWC rules and covers every proxy path the JS uses;
- manifest icons exist; no tokens committed anywhere in the repo (root, `site/`, `scripts/`, `tests/`); no `console.log`.

**Unit tests** load the real inline script into a Node VM with a fake DOM (`harness.js`) and exercise the pure functions:
- `taf.test.js` — `tafLineCat` flight categories (including the fraction-after-time-group and `M1/4SM` bugs), `colorTaf`.
- `metar.test.js` — ceilings (`OVX`), sky wording, `getCat` thresholds, altimeter inHg, density altitude, wind/temperature text, escaping.
- `runway.test.js` — headwind/crosswind math, best-runway choice, `RUNWAYS` table sanity.
- `geo.test.js` — haversine, point-in-polygon, distance to polygon edge, `AIRPORTS` table.
- `header-weather.test.js` — rain/snow/lightning detection from the METAR body only.
- `misc.test.js` — winds-aloft decoder, midnight clock, DST abbreviation, NWS alert table, proxy map, top-level entry points, `normalizeIcao`, `metarDetailHtml`.

## Adding a test

Pure functions are reached as `ctx.<name>`; script-scoped constants are exported through `x` in `harness.js` (add to `exportLine` if you need another). Objects created inside the VM have a different prototype, so wrap them in `plain()` before `deepEqual`.

## Not covered

Anything that needs a browser: rendering, layout at each viewport, pull-to-refresh, the briefing modal's DOM, live API responses. Those are still checked by hand on a Netlify draft before each deploy (see `AGENTS.md`).
