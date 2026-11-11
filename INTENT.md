# Intent: Aviation Situation Dashboard (ASD)

## What this is

The Aviation Situation Dashboard is a one-page web app that shows current aviation weather around Bowling Green, Ohio (1G0). It was built for BGSU aviation students and faculty, starting with AERT 2800 (Part 141 instrument ground school). It is used in two ways:

- On phones, tablets, and laptops, so students can check conditions before flying or class.
- On classroom projectors and large screens, so the instructor can discuss current weather with the room.

Live site: https://aert2800wx.netlify.app

## What it is not

The dashboard is for instruction and situational awareness only. It is not an official weather briefing and must not be used for flight planning. This warning appears in the app and must stay there.

## Who it serves

- Students learning to read METARs, TAFs, charts, PIREPs, advisories, and TFRs.
- The instructor (Micah Maziar), who presents it in class and owns every product decision.
- BGSU flight operations users who want a quick look at local conditions and the BGSU fleet on ADS-B.

## Guiding principles

These came out of the decisions made while building the app. When a new request is unclear, follow these.

1. **Accuracy over cleverness.** If a feature can show wrong information, remove it or make it safer. Examples:
   - The "Classroom tips" callouts were removed for good. The owner said there was too much liability if they were ever wrong.
   - The "Currently VFR/MVFR/IFR" summary was removed after it showed "clear skies" with a scattered layer.
   - Per-airport NOTAM links were removed because the FAA site could not deep-link to an airport.
   - SUA "May be active" status text was removed. The disclaimer at the top is enough.
2. **Use authoritative sources and show them as issued.** TFR polygons come straight from the FAA. Raw METAR, TAF, and NOTAM text is shown exactly as published.
3. **Tell users when the data is old or missing.** Never hide an airport or quietly show stale data. Keep the last good data, mark it as stale, and point users to aviationweather.gov.
4. **Fast and reliable on a classroom network.** Weather data loads first. Same-origin Netlify proxies are preferred over free third-party CORS proxies. Retry slow or empty responses.
5. **Plain, readable, not distracting.** Use plain-language decoding ("Broken ceiling at 3000 ft"). Large text on big screens. Animations stay subtle. The sky flash was rejected because it was distracting.
6. **Classroom controls stay out of the way.** The fullscreen and briefing-view buttons are dimmed so regular users aren't confused by them.
7. **Nothing plays on its own.** The ATC pre-duty briefing video loads only after a click.
8. **Easy to roll back.** Big visual features, such as the weather-themed header, should be self-contained so they can be reverted in one deploy.

## Decisions to keep

| Decision | Reason |
|---|---|
| Single `index.html`, no build step | Simple to deploy and easy to review |
| Served files in `site/`, docs and tooling at the repo root | Keeps the publish directory clean; the deploy only ever uploads `site/` |
| Runway winds as a north-up sketch of the real layout, not a table | Students see the wind against the actual runways; the numbers stay on each runway end |
| Runway geometry from the FAA footprint layer, runways only | Taxiways and aprons add clutter without helping the wind picture; FAA data beats a hand-kept heading table (it caught two wrong headings and one wrong airport position) |
| Netlify `_redirects` reverse proxy for AWC, NWS, and FAA TFR data | Third-party CORS proxies caused 30-second loads and outages |
| Weather themes and animations read only the KTOL METAR body, before `RMK` | Remarks like `TSNO` and `LTG DSNT` caused false snow and thunderstorm triggers |
| TFR alerts cover active or scheduled TFRs within 75 nm of 1G0 | Owner's choice. Each TFR has its own modal, with no combined map |
| Winds aloft use only FWA, CLE, and CMH, at 9,000 ft and below | These are the closest FD stations. TOL, DET, and DTW are not in the FD product |
| ADS-B map loads automatically (no click-to-load) | Owner's choice. Slow loads are an airplanes.live issue |
| No service worker | Live data matters more than offline use. A version banner handles updates |

## Backlog

Shelved ideas and open items are in `BACKLOG.md`.

- **Regional radius is 150 nm.** PIREPs, SIGMETs, and G-AIRMETs all use 150 nm from 1G0 (owner decision, Nov 2026; an earlier 100 nm PIREP request is superseded).

- **Briefing view type is sized for the back of a classroom.** The raw METAR and TAF are always the same size and as large as the layout allows (owner request, Nov 2026, v1.29 and v1.31). When space is tight, prefer letting a pane scroll over shrinking the type.
