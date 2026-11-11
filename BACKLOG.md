# Backlog: Aviation Situation Dashboard

Ideas and open items that are not yet built. Nothing here should be built until the owner approves it. When an item ships, remove it here and update `SPEC.md`.

## Needs a decision

- Add a small text box and a Go button to allow a user to input a airport's location identifier (LOCID) and have the METAR and TAF, if available, pop up in a modal. The modal should also include the text box and go button in case the user wants to check weather at a different airport.
- Is there a way to add a 

## Fixes and cleanup

- **NWS alerts in one call.** Alerts currently make one call per airport (15 calls every 15 min). A single area or zone query would be cheaper, but matching alerts to airports by zone geometry is fragile. Only worth doing if NWS rate limits become a problem.

## Waiting on outside changes

- **Per-airport NOTAM links.** These were removed because FAA NOTAM Search can't link directly to an airport. Revisit when the FAA's NOTAM system supports it (expected after the October update).

## Testing (next layer, not built)

- **Browser tests with Playwright** against saved AWC fixtures: no console errors, 15 cards, outage banner behaviour, open `<details>` surviving re-render, briefing view with no pane overlaps at 390×844 / 820×1180 / 1180×820 / 1920×1080, no CAVU iframe before click, disclaimers present.
- **Production smoke check** (run on command): live `version.txt` matches served `CURRENT_VERSION`; each `_redirects` proxy returns JSON; KTOL METAR present.

## Shelved ideas

- **Aviation events within 150 nm** (fly-ins, airshows). There is no free API. Options are AOPA or EAA link cards, or a list updated by hand each semester.
- **Combined TFR map.** Show all nearby TFRs on one map. The owner chose per-TFR modals for now.
- **App store versions.** Wrap the app with Capacitor or similar. Apple may reject apps that only wrap a website.
- **Service worker.** Full PWA offline caching. It's of little value for live weather.

## Ideas offered but not chosen

These were suggested in v.051. Only the Convective Outlook and CWAs were built.

- D-ATIS for airports that have it available. https://atisrelay.com/api_docs
- NWS Area Forecast Discussion (CLE or ILN offices).
- Side-by-side icing PIREPs and G-AIRMET icing.
