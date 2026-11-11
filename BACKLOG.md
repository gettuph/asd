# Backlog: Aviation Situation Dashboard

Ideas and open items that are not yet built. Nothing here should be built until the owner approves it. When an item ships, remove it here and update `SPEC.md`.

## Needs a decision

- **PIREP radius.** The owner asked for 100 nm in v.059, but the current code and card label use 150 nm. Confirm which is correct.

## Fixes and cleanup

- **Refresh button coverage.** The v.094 audit found the refresh button only refreshed METARs and TAFs, not alerts, winds aloft, or TFRs. Check whether this is still true and fix it if so.
- **SUA proxy.** Special Use Airspace (ArcGIS) still uses the third-party proxies codetabs and allorigins. Add a Netlify `_redirects` rule.
- **NWS alerts in one call.** Alerts currently make one call per airport (15 calls). Consider a single area or zone query.

## Waiting on outside changes

- **Per-airport NOTAM links.** These were removed because FAA NOTAM Search can't link directly to an airport. Revisit when the FAA's NOTAM system supports it (expected after the October update).

## Shelved ideas

- **Aviation events within 150 nm** (fly-ins, airshows). There is no free API. Options are AOPA or EAA link cards, or a list updated by hand each semester.
- **Combined TFR map.** Show all nearby TFRs on one map. The owner chose per-TFR modals for now.
- **App store versions.** Wrap the app with Capacitor or similar. Apple may reject apps that only wrap a website.
- **Service worker.** Full PWA offline caching. It's of little value for live weather.

## Ideas offered but not chosen

These were suggested in v.051. Only the Convective Outlook and CWAs were built.

- D-ATIS for KTOL and KDTW.
- NWS Area Forecast Discussion (CLE or ILN offices).
- Side-by-side icing PIREPs and G-AIRMET icing.
