# Specification: Aviation Situation Dashboard

Current version: **v1.38** (`CURRENT_VERSION` in `site/index.html` and `site/version.txt`).
Reference point: 1G0, Wood County Airport, Bowling Green, OH (41.39, -83.63). All distances are in nautical miles from 1G0 unless noted.

## 1. Architecture

- One static file, `site/index.html` (HTML, CSS, and JavaScript inline). No framework and no build step. Everything served lives in `site/`; docs, tests, and the deploy script sit at the repo root.
- Hosted on Netlify (site `aert2800wx`). The publish directory is `site/`.
- `netlify/functions/atis.js` is a Netlify Function (Lambda-compatible) that relays D-ATIS from ATIS Relay. It holds the key (`ATIS_RELAY_KEY`, a Netlify environment variable, never in the repo), answers only for allow-listed airports (KDTW), and caches responses on Netlify's durable CDN cache. The dashboard asks for `?icao=XXXX&b=N`, where N is the current 5-minute time bucket (`BUCKET_S` = 300); the function accepts only the current bucket ±1 (anything else: 400 `bad_bucket`, not cached, no upstream call) and caches each bucket's answer for 600 s, and a warm instance reuses its last answer for 5 minutes. So ATIS Relay sees about one request per airport per 5 minutes, however many browsers are open or Refresh presses happen. Requests without `b` are cached 300 s. On `429` it waits at least `Retry-After` (minimum 60 s) and caches that refusal for the same time.
- The FAA ADDS runway-footprint layer (`services6.arcgis.com/ssFJjBXIUyZDrSYZ/.../Runways/FeatureServer/0`) is fetched directly; it sends `Access-Control-Allow-Origin: *`, so no proxy rule is needed. Its quota is about 6000 request units per minute per client, so it is fetched once per 56 days, not per refresh.
- `_redirects` provides same-origin reverse proxies:

| Path | Upstream |
|---|---|
| `/awc/{metar,taf,pirep,airsigmet,gairmet,windtemp}/` | `https://aviationweather.gov/api/data/...` |
| `/nws/*` | `https://api.weather.gov/*` |
| `/tfr/*` | `https://tfr.faa.gov/*` |

- Fetch order for AWC data: Netlify proxy first, then fallback to codetabs and allorigins. Each try has its own timeout (proxy timeout is 10 s).
- External libraries: Leaflet 1.9.4 (TFR map, OpenStreetMap tiles). Fonts: General Sans, JetBrains Mono.
- Other sources: Open-Meteo (BG high/low), ArcGIS FAA Special Use Airspace feature service, NWS radar, WPC prog charts, SPC outlook, airplanes.live, and CAVU pre-duty brief.
- PWA-lite: `manifest.json` and icons for Add to Home Screen. There is no service worker.

## 2. Airports

There are 15 airports in three distance groups. Each has ICAO code, name, city, distance, latitude/longitude, and runway headings for wind components.

- **Local (35 mi or less):** KTOL, KTDZ, KFDY, KDUH
- **Area (36–90 mi):** KADG, KDTW, KFWA, KJXN, KMFD
- **Region (more than 90 mi):** KAZO, KCLE, KCMH, KDAY, KGRR, KMIE

## 3. Layout

- **Header:** ASD icon (same as the iOS home-screen icon), title, and version. The clock line shows 12-hour local, 24-hour local, and Zulu time, followed by `BG ↑hi° ↓lo°`.
  - Clock colons blink once a second instead of showing running seconds, so the layout doesn't shift.
  - 24-hour time uses `hourCycle: 'h23'`, so midnight shows 00:xx.
  - Controls, left to right: airport lookup box + Go (dimmed; collapses to a dimmed magnifier icon below 700 px), briefing view (dimmed), fullscreen (dimmed, hidden if the browser doesn't support it), light/dark toggle, and refresh.
- **Tabs, in order:** Airports, Charts, Region, ADS-B, ATC Brief. On desktop, Airports, Charts, and Region show as three equal columns.
- **Banners, at the top as needed:** new version available, METAR outage, stale data, and TFR.

## 4. Airport cards

Each card shows, in this order:

1. **Header:** ICAO code, name, flight-category badge, and observation age.
   - Age color: green for 60 min or less, yellow for 61–74 min, red for 75 min or more.
   - NWS alert badges sit on the right.
2. **Raw METAR:** monospace, not color-coded. It wraps only at spaces, never in the middle of a group.
3. **Decoded fields:** wind, visibility, sky, altimeter, temperature/dewpoint, and density altitude.
   - Sky wording:
     - `SKC` → "Clear"
     - `CLR` → "Clear below 12,000 ft"
     - `FEW040` → "Few at 4000 ft"
     - `SCT` → "Scattered at…"
     - `BKN030` → "Broken ceiling at 3000 ft"
     - `OVC` → "Overcast ceiling at…"
     - `VV` or `OVX` → "Indefinite ceiling at…"
   - Density altitude is pressure altitude plus 120 × (OAT − ISA temperature). Pressure altitude comes from the altimeter setting, and field elevation from the AWC `elev` field.
4. **TAF** (tap to expand): each line is colored by flight category (VFR green, MVFR blue, IFR red, LIFR purple).
   - Visibility parsing must handle fractions and `M1/4SM`, and must not read times as visibility.
5. **D-ATIS** (collapsible, KDTW only; `ATIS_AIRPORTS`): between the TAF and Runway winds. Collapsed by default; nothing is fetched until it is opened. Opening it calls `/.netlify/functions/atis?icao=KDTW&b=<5-min bucket>`; while open it updates every 10 minutes (`ATIS_REFRESH_MS`; checked every 30 s, skipped while the tab is hidden), throttled per airport (60 s after a failure) so card re-renders can't loop.
   - Summary: "D-ATIS — Arrival I · Departure V" once loaded; "D-ATIS — arrival & departure" before.
   - Top line (caution colors): "⚠️ Unofficial. Not for operational use. Confirm on frequency. NOT FOR OPERATIONAL USE." — ATIS Relay's required notice, word for word, plus the FAA SWIM warning.
   - Arrival and Departure blocks: "Arrival — Information I", issue time from `DATISTime` (DDHHMM UTC) with age, and the full ATIS text as issued, unedited. An ATIS more than 65 minutes old adds "This ATIS is more than an hour old and may be out of date." Airports with a single combined ATIS show one "ATIS" block.
   - Any other message ATIS Relay returns (a different `notice`, or unknown text fields) is shown, never dropped. A failed refresh keeps the last report and says "Couldn't refresh D-ATIS (reason). Showing the report received HHMMZ."; with nothing cached it says "D-ATIS unavailable right now (reason)."
   - Footer: "Data: ATIS Relay" linked to https://atisrelay.com · "Digital ATIS from FAA SWIM", and a Refresh button on the right. Refresh fetches right away ("Refreshing…") but works at most once per 5 minutes after the last fetch (`ATIS_MANUAL_MS`); while locked it is dimmed and reads "Refresh available HHMMZ", and it re-enables itself when the lockout ends. The function enforces the same 5-minute window.
   - Also shown during an AWC outage (after the TAF), since it doesn't depend on AWC.
6. **Runway winds** (collapsible): a north-up SVG sketch (`runwaySketchSvg`) of the airport's actual runway layout. It is always shown when runway data exists.
   - **Geometry source:** the FAA ADDS "Runways" footprint layer (ArcGIS FeatureServer, public, CORS-open, no key), queried once per airport at page load by a ±0.03° envelope around the airport point (`fetchRunwayGeo`). Results are cached in `localStorage` (`asd.rwygeo.v1`) for 56 days, the FAA's publication cycle. The nearest airport's polygons are kept; helipads (`H…`) and closed/unverified (`…X`) designators are dropped (`parseFaaRunways`). The caption reads "FAA runway footprints".
   - Each footprint polygon is reduced to its centerline and width (`ringAxis`, principal axis); the true heading comes from the geometry and the low-numbered end is the one whose outbound bearing matches its designator. Runways are drawn to scale in position, length, and orientation; pavement width is exaggerated to a minimum of 7 units so it reads on screen.
   - **Fallback:** if the FAA layer is unreachable and nothing is cached, the sketch uses the `RUNWAYS` heading table (lines through a common center) and the caption reads "Runway headings (FAA footprints unavailable)". Table headings are checked against the footprints in `npm test`.
   - A blue arrow points from the direction the wind blows **from** toward the center; the legend reads "Wind 060° at 7 kt" (plus "gusting N kt"). "N ↑" marks north.
   - **Labels:** parallel ends within 12° and 110 units share one label (`compactNames`: "03L/R · 04L/R"). Each label has the designator, "Headwind N kt" or "Tailwind N kt" (tailwind in red), and "XW N kt L/R" (amber ≥10 kt, red ≥15 kt), spelled out with no checkmarks, from the existing `windComponents` math on the sustained wind. `layoutLabels` starts each label just outside its runway end, pushes overlapping labels apart, keeps them inside the drawing and off the runway area, and draws a thin leader when a label ends up more than 14 units from its end.
   - The favored end (`bestRunwayEnd`: greatest headwind, ties to the smaller crosswind) gets a green pill and its runway is drawn darker.
   - ViewBox 440×360; the SVG fills the card up to 460 px wide, so label text runs from about 10.5 px on a phone to 15 px on a wide card.
   - Calm → sketch with designators only plus "Calm — no crosswind component"; Variable → sketch with designators only plus "Variable at X kt — crosswind component indeterminate". No arrow, no components, no pill in either case.
7. **Remaining callouts:** fog risk from a small temperature/dewpoint spread, icing range, low altimeter, convective activity, freezing precipitation, snow, and TAF alternate analysis.
   - They are based only on the METAR body before `RMK`.
   - No wind callouts and no VFR/IFR summary callout.

Open `<details>` panels (TAF, runway winds, SUA) must stay open through the 2-minute re-render.

## 5. Charts tab

- **Radar:** NWS RIDGE loops, including Central Great Lakes.
- **Surface analysis and prog charts:** WPC images. Links under a "Freezing level, icing & turbulence" divider go to the GFA freezing level, CIP icing, icing probability, and turbulence pages.
- **Convective & Center Wx card:**
  - SPC Day 1 outlook, full-size `day1otlk.png`.
  - Links to ZOB CWAs and all CWAs (NWS product viewer), AWC GFA Convective, and SPC Days 1–3.
- On desktop, clicking an image opens a lightbox up to 1400 px wide (or 92vw), with height capped at 88vh.

## 6. Region tab

Shown in this order:

1. **Special Use Airspace:** MOAs and restricted areas within 150 nm, from ArcGIS. Includes R-5502A/B and the Stinger MOA.
   - Collapsed by default. The header reads "Special Use Airspace" plus "⚠️ Always check NOTAMs" and a toggle that switches between "Click to view ▼" and "Click to close ◄".
   - Entries show name, type, altitudes, and published schedule, with no activity guess.
2. **Winds Aloft (9,000 ft and below):** FWA, CLE, and CMH at 3,000, 6,000, and 9,000 ft, decoded to direction, speed, and temperature.
   - The header shows the valid and "for use" times.
   - The product is stale only after the end of its "for use" window.
   - Strip the "TEMPS NEG ABV 24000" line.
3. **SIGMETs:** within 150 nm, using point-in-polygon plus distance to the nearest edge.
4. **G-AIRMETs:** within 150 nm, at or below 10,000 ft, with the same polygon test.
5. **PIREPs:** within 150 nm, at or below FL100, up to 10, decoded for turbulence and icing. Urgent (UUA) and severe reports are highlighted.
6. **NOTAMs:** a single link to FAA NOTAM Search. No per-airport links.

## 7. Alerts and banners

- **NWS alert badges:**
  - One call to `/nws/alerts/active?point=lat,lon` per airport, every 15 minutes.
  - The first call waits 5 s after page load (3 s after a manual refresh) so METARs and TAFs load first.
  - Covered event types are listed in `ALERT_TYPES`: tornado, severe thunderstorm, heat, winter and cold, dense fog, high wind and wind advisory, and air quality. Badge labels are not abbreviated when there's room.
  - Clicking a badge opens an opaque modal with the headline, description, instructions, expiration time in EST/EDT, and the issuing office. It closes with ×, a click on the overlay, or Escape.
- **Stale data banner** (purple):
  - Triggers when a METAR is 75 minutes old or more, or when a TAF has expired (`validTimeTo` is in the past). It checks only after the first successful fetch, then every minute.
  - It lists the affected airports and says: "Check aviationweather.gov directly for current conditions."
- **METAR outage banner** (red):
  - Shown when AWC returns no data. All airport cards stay visible, and the last known data is kept.
  - Each card says: "AWC API not responding — no METAR data available. Check aviationweather.gov directly." TAFs still display.
  - The banner clears itself when data returns.
- **TFR banner:**
  - Lists active or scheduled TFRs within 75 nm of 1G0, from the FAA WFS feed, checked every 5 minutes. Each TFR name is a separate link.
  - Clicking a name opens a modal with two tabs:
    - **Map:** Leaflet map with the TFR polygon in red, a blue 1G0 marker labeled "1G0 — Bowling Green", and the view fitted to both.
    - **NOTAM text:** raw text from `/tfr/tfrapi/getNotamText`, cached after the first load.
  - The details list shows type, altitudes, times (UTC), facility, and NOTAM number.
  - The FAA detail link format is `https://tfr.faa.gov/tfr3/#detail/{series}/{number}`.
- **Version banner:** the app checks `/version.txt` at load and every 5 minutes. If the version differs from `CURRENT_VERSION`, a banner shows "A new version is available" with an Update Now button that hard-reloads the page.

## 8. Header weather theme

The header theme is based only on the KTOL METAR body, before `RMK`.

- **Season palette:** winter steel blue, spring forest green, summer navy-blue, fall amber. It turns darker after 8 PM ET.
- **Condition overrides:** MVFR, IFR, LIFR, thunderstorm or CB, snow, dense fog, and an active Air Quality Alert each have their own gradient. Gradients fade over 2 seconds.
- **Text:** header text turns white once the theme applies, so it always contrasts with the background.
- **Precipitation animation (canvas):**
  - Rain (`-RA`/`DZ`, `RA`, `+RA`) uses 38, 75, or 110 particles.
  - Snow (`-SN`/`SG`, `SN`, `+SN`) uses 28, 52, or 80 particles.
- **Lightning:**
  - Bolt size and frequency scale with `LTG DSNT`, `OCNL`, `VC`, `FRQ`, and `CONT`, and with TS or CB in the METAR body.
  - Bolts fade in and out. There is no sky flash.
- **iOS:** the header must not use `overflow: hidden` together with sticky positioning. The canvas uses `translateZ(0)`.

## 9. Briefing view (full-screen modal)

- Opened by the dimmed grid icon to the left of the fullscreen button. Closes with ×, Escape, or the icon.
- Top warning, verbatim: "⚠️ This information is for situational awareness only. It must not be used for official flight planning. Always obtain a proper weather briefing through approved sources."
- **Content:**
  - KTOL METAR: category badge, alert badges, raw text, and decoded fields including density altitude.
  - KTOL TAF, colored by category.
  - WPC 12-hour prog chart.
  - Central Great Lakes radar loop.
  - Local and Zulu clock.
- **Layouts:**
  - 1400 px and wider: 3 columns (METAR over TAF, then the prog chart, then radar). The text column is 1.25× the width of each image column; the two images get equal width with no cropping or stretching.
  - iPad landscape: 2×2.
  - iPad portrait: METAR | TAF over the charts, scrollable.
  - Phone: single column.
- **Text size:** the raw METAR and the TAF always use the same size, scaled with viewport width: about 34 px on a 1920-wide display (`clamp(22px, 1.75vw, 36px)`), 20 px on an iPad in landscape, 16 px on a phone. Decoded METAR fields are one step smaller (about 27 px at 1920).
- **Row heights (1400 px and wider):** the METAR row sizes to its content up to 58 vh and the TAF row takes the rest (`grid-template-rows: fit-content(58vh) minmax(0,1fr)`). A typical 3-line METAR and a 7-period TAF both fit at 1080p without scrolling; an unusually long METAR borrows height from the TAF, which then scrolls. Panes scroll instead of clipping.
- **Images:** positioned absolutely inside their panes so Safari can't overflow the grid. Grid tracks use a minimum of 0.

## 9a. Airport lookup (modal)

- A text box (placeholder `LocID`, shown in mixed case, sized to fit it; 4 characters max) and a Go button in the header. Go or Enter opens a centered modal (max 780 px) with the station's current weather. Below 700 px the box is replaced by a magnifier icon that opens the same modal with the box focused and a prompt to enter an identifier.
- Top warning, verbatim: "⚠️ This information is for situational awareness only. It must not be used for official flight planning. Always obtain a proper weather briefing through approved sources."
- The modal header shows the identifier, the station name from AWC when available, and repeats the text box and Go button so another airport can be checked without closing.
- **Identifier handling (`normalizeIcao`):** trimmed, upper-cased, non-alphanumerics removed. A three-letter alphabetic ID gets a `K` prefix (TOL → KTOL). Anything else is sent as typed (CYYZ, EGLL, 1G0).
- **Content:** METAR (category badge, raw text, decoded fields including density altitude — the same `metarDetailHtml` block the briefing view uses, with the observation time and age), then the TAF colored by category with its issue time. Missing data shows "No METAR found for XXXX." / "No TAF issued for XXXX."; an unreachable AWC shows "Could not reach Aviation Weather Center. Try again in a moment."
- **Fetching:** only when Go is pressed, through the existing `/awc/metar/` and `/awc/taf/` proxies (`wxFetch`). Nothing is polled; the 15-airport refresh cycle is unaffected. A newer lookup supersedes a slower earlier one.
- Closes with ×, Escape, or a click on the backdrop; closing clears both boxes so the `LocID` placeholder shows again. Pull-to-refresh is blocked inside it.
- Text size: raw METAR/TAF `clamp(14px, 1.1vw, 22px)`, decoded fields `clamp(13px, 1vw, 19px)`.

## 10. ADS-B and ATC Brief tabs

- **ADS-B:** an airplanes.live iframe that loads automatically. All Traffic and BGSU Fleet toggles. BGSU Fleet (`filterCallSign=BG`) is the default.
- **ATC Brief:** CAVU ZOB pre-duty brief. It shows a "Load ATC Pre-Duty Weather Brief" placeholder that notes the video has audio. The iframe is created only after a click, so nothing autoplays.

## 11. Refresh timing

| Item | Interval |
|---|---|
| METAR, TAF, PIREP, SIGMET, G-AIRMET | 2 min, plus one retry 8 s after an empty METAR or TAF response |
| Radar, prog, and SPC images | 5 min, with a cache-buster |
| TFR check | 5 min |
| Version check | 5 min |
| Airport lookup | on demand only (Go / Enter) |
| KDTW D-ATIS | only while its panel is open: on open, then every 10 min; Refresh button at most once per 5 min (function serves one cached copy per 5-min bucket) |
| FAA runway footprints | once per page load, served from a 56-day localStorage cache |
| NWS alerts | 15 min |
| Winds aloft | 60 min |
| BG high/low (Open-Meteo) | 60 min |
| Stale data check | 1 min |
| Clocks | 1 s |

- **Pull-to-refresh** (touch): pulling 75 px or more reloads the page. Short pulls, `touchcancel`, and drags inside modals, maps, iframes, or scrolled areas reset without reloading.
- **Refresh button:** triggers a data refresh.

## 12. Display rules

- Light and dark modes. Use defined CSS variables only. A missing `--card` variable once made the alert modal transparent.
- On screens 1400 px and wider, airport cards use larger type (15 px raw text, 17 px names).
- HTML escaping uses a string regex, not DOM elements.

## 13. Acceptance checks before every deploy

1. No console errors on load. Test on a Netlify draft URL first.
2. METARs and TAFs appear within a few seconds. Every airport card renders, even during an outage.
3. Bump the version in both `CURRENT_VERSION` and `version.txt`.
4. Check the layout at phone, iPad portrait, iPad landscape, desktop, and 1920×1080.
5. Check that remark text (for example `TSNO`, `LTG DSNT`, `FZRANO`) doesn't trigger a weather effect.
6. All functions stay at the top level. A missing `}` once nested every fetch function inside `renderRegional()` and broke the whole app.
7. Any element the script touches at load time (top-level `addEventListener`) must appear in the HTML before the `<script>`. The modals come after it; wire them with inline `on…` attributes or inside functions. A top-level listener on the lookup modal once threw at load and froze the whole page on "Loading data…" (caught on the v1.32 draft; now a static check).

## 14. Open questions

See `BACKLOG.md`.
