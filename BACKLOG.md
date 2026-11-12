# Backlog: Aviation Situation Dashboard

Ideas and open items that are not yet built. Nothing here should be built until the owner approves it. When an item ships, remove it here and update `SPEC.md`.

## Planned (approved direction, not yet built)

- **1G0 AWOS on demand via ATIS Relay.** Wood County (1G0) has an AWOS-3PT (120.725, 419-354-1415) that is not on the FAA network, and the airport won't connect it. Plan: a Netlify Function (`netlify/functions/awos-1g0.js`) holding an ATIS Relay API key in Netlify's environment settings relays two calls — `GET /api/atis_relay_dial?icao=1G0&product=awos` to start a capture and `GET /api/atis_relay_airport?icao=1G0` to read the transcript. A "1G0 AWOS" card in the local group gets a button that requests a fresh report and shows the transcript, its age, a parsed METAR-style line only when the transcript parses cleanly, and the "Unofficial. Not for operational use." notice. On demand only (no scheduling) so a few requests a day stay inside the plan's 100 included dials (overage is 19¢ per usable dial; dialing is capped at once per 10 minutes per airport). Owner creates the ATIS Relay account and sets the key in Netlify. **Blocked (2026-11-11):** tested with the owner's Plus-tier key — `atis_relay_dial?icao=1G0` returns 404 "Airport not found" (also for K1G0); `faa_loc_id=1G0` returns 422 `not_dialable`, and the airport endpoint with `faa_loc_id` returns the wrong airport (a Haines, AK airpark; same for TOL), so that lookup is broken on their side. 1G0 is not in their transcribed-airport index. Owner to ask ATIS Relay support to make 1G0 addressable in the API and enable its AWOS phone path. Owner added `ATIS_RELAY_KEY` to Netlify (functions/runtime scope) on 2026-11-11. Retested the same day: still 404 / 422 `not_dialable`.
  - **License: Personal use. owner will reach out to the company for permission. 
  - **API blocker (still open, retested 2026-11-11):** the 1G0 web page offers "Request current AWOS" (site airport id 13276), but the API cannot address it: `icao=1G0`/`K1G0` → 404 "Airport not found"; `faa_loc_id`, `id`, `airport_id`, and `ident` are ignored and fall back to a default airport (Airkat Airpark, Haines AK), which is why they return `not_dialable`. The website's own request form must not be used (Terms §5; API docs: "Do not poll the website HTML. Use this API."). Ask ATIS Relay support to make 1G0 addressable in `atis_relay_dial` and `atis_relay_airport` (by FAA LID or by airport id 13276).
  - Background on the licence question (ATIS Relay Terms of Use §5, §14, revised 2026-11-01): a Plus subscription is for one person's own use and explicitly excludes feeding ATIS Relay data into websites or displays "for a school". A public classroom dashboard needs a **Commercial plan** (must set a monthly billing limit) or a **separate written agreement**.
  - **Compliance checklist for the build (ATIS Relay API Terms):** show "Data: ATIS Relay" linked to https://atisrelay.com wherever the data appears; show "Unofficial. Not for operational use. Confirm on frequency." next to it, word for word; never hide `official`, `call_status`, staleness, or other warnings the API returns; don't imply FAA approval; cache responses no longer than 24 hours and keep no archive; the key stays in the Netlify Function — visitors must never be able to call the API with it, so the function itself enforces at most one dial per 10 minutes and one at a time (Phone Line Policy) and otherwise serves the cached report; send a descriptive `User-Agent` with a contact; on `429`, wait at least `Retry-After` and back off; never read the atisrelay.com website HTML. Open: ask ATIS Relay about hosting a receive-only station near the field, which would make 1G0 continuous with no dials. Reference: https://atisrelay.com/api_docs

## Needs a decision

- Add IND to the 90+ tab.
- Add D-ATIS for airports that have it available using the ATIS relay api.

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

- D-ATIS for airports that have it available. https://atisrelay.com/api_docs (KDTW arrival/departure built in v1.37; other D-ATIS airports in range, e.g. KCLE, KCMH, KDAY, KGRR, would only need adding to `ATIS_AIRPORTS` and the function allow-list — owner decides.)
- NWS Area Forecast Discussion (CLE or ILN offices).
- Side-by-side icing PIREPs and G-AIRMET icing.
- Agent to call 1G0 ASOS at 55 minutes past each hour and transcribe the METAR from the ASOS. (Superseded by the ATIS Relay on-demand plan above; 1G0 has an AWOS-3PT, not an ASOS.)
