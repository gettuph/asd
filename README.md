# Aviation Situation Dashboard (WxBrief)

Classroom aviation weather display for BGSU aviation instruction: METARs/TAFs, PIREPs, AIRMET/SIGMETs, winds aloft, NWS alerts, TFR warnings, radar, prog charts, and a full-screen briefing view.

**For instruction and situational awareness only. Not for official flight planning — obtain an approved weather briefing.**

Live site: https://aert2800wx.netlify.app

## Files
- `index.html` — the full app (single file)
- `_redirects` — Netlify reverse-proxy rules for aviationweather.gov, api.weather.gov, and tfr.faa.gov
- `version.txt` — current version; the app checks it to show an "update available" banner
- `manifest.json`, icons — home-screen/PWA metadata
- `AGENTS.md`, `INTENT.md`, `SPEC.md`, `BACKLOG.md` — project docs for contributors and AI agents

## Deploy
Static site, no build step. On Netlify, set the publish directory to the repo root.
