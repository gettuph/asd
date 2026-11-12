# Backlog: Aviation Situation Dashboard

Ideas and open items that are not yet built. Nothing here should be built until the owner approves it. When an item ships, remove it here and update `SPEC.md`.

## Planned (approved direction, not yet built)

- **1G0 AWOS on demand via ATIS Relay.** Wood County (1G0) has an AWOS-3PT (120.725, 419-354-1415) that is not on the FAA network, and the airport won't connect it. Plan: a Netlify Function (`netlify/functions/awos-1g0.js`) holding an ATIS Relay API key in Netlify's environment settings relays two calls — `GET /api/atis_relay_dial?icao=1G0&product=awos` to start a capture and `GET /api/atis_relay_airport?icao=1G0` to read the transcript. A "1G0 AWOS" card in the local group gets a button that requests a fresh report and shows the transcript, its age, a parsed METAR-style line only when the transcript parses cleanly, and the "Unofficial. Not for operational use." notice. On demand only (no scheduling) so a few requests a day stay inside the plan's 100 included dials (overage is 19¢ per usable dial; dialing is capped at once per 10 minutes per airport). Owner creates the ATIS Relay account and sets the key in Netlify. Open: ask ATIS Relay about hosting a receive-only station near the field, which would make 1G0 continuous with no dials. Reference: https://atisrelay.com/api_docs

## Needs a decision

- (none)

## Fixes and cleanup

- **NWS alerts in one call.** Alerts currently make one call per airport (15 calls every 15 min). A single area or zone query would be cheaper, but matching alerts to airports by zone geometry is fragile. Only worth doing if NWS rate limits become a problem.

## Waiting on outside changes

- **Per-airport NOTAM links.** These were removed because FAA NOTAM Search can't link directly to an airport. Revisit when the FAA's NOTAM system supports it (expected after the October update).

## Testing (next layer, not built)

- **Browser tests with Playwright** against saved AWC fixtures: no console errors, 15 cards, outage banner behaviour, open `<details>` surviving re-render, briefing view with no pane overlaps at 390×844 / 820×1180 / 1180×820 / 1920×1080, no CAVU iframe before click, disclaimers present.
- **Production smoke check** (run on command): live `version.txt` matches served `CURRENT_VERSION`; each `_redirects` proxy returns JSON; KTOL METAR present.

## Shelved ideas

- **App store versions.** Wrap the app with Capacitor or similar. Apple may reject apps that only wrap a website.

## Ideas offered but not chosen

These were suggested in v.051. Only the Convective Outlook and CWAs were built.

- D-ATIS for airports that have it available. https://atisrelay.com/api_docs
- NWS Area Forecast Discussion (CLE or ILN offices).
- Side-by-side icing PIREPs and G-AIRMET icing.
- Agent to call 1G0 ASOS at 55 minutes past each hour and transcribe the METAR from the ASOS. (Superseded by the ATIS Relay on-demand plan above; 1G0 has an AWOS-3PT, not an ASOS.)
