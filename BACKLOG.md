# Backlog: Aviation Situation Dashboard

Ideas and open items that are not yet built. Nothing here should be built until the owner approves it. When an item ships, remove it here and update `SPEC.md`.

## Needs a decision

- **PIREP radius.** The owner asked for 100 nm in v.059. The code filtered at 100 nm but the card label said 150 nm; v1.24 changed the filter to 150 nm to match the label and the SIGMET/AIRMET radius. If 100 nm is preferred, change both the filter in `renderRegional()` and the card title.

## Fixes and cleanup

- **NWS alerts in one call.** Alerts currently make one call per airport (15 calls every 15 min). A single area or zone query would be cheaper, but matching alerts to airports by zone geometry is fragile. Only worth doing if NWS rate limits become a problem.

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
