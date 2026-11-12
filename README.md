# Aviation Situation Dashboard (WxBrief)

Classroom aviation weather display for BGSU aviation instruction: METARs/TAFs, PIREPs, AIRMET/SIGMETs, winds aloft, NWS alerts, TFR warnings, radar, prog charts, and a full-screen briefing view.

**For instruction and situational awareness only. Not for official flight planning — obtain an approved weather briefing.**

Live site: https://aert2800wx.netlify.app

## Layout
- `site/` — everything Netlify serves (the publish directory)
  - `index.html` — the full app (single file)
  - `_redirects` — Netlify reverse-proxy rules for aviationweather.gov, api.weather.gov, and tfr.faa.gov
  - `version.txt` — current version; the app checks it to show an "update available" banner
  - `manifest.json`, `favicon.svg`, `icon-*.png` — home-screen/PWA metadata
- `netlify/functions/atis.js` — D-ATIS relay (holds the ATIS Relay key from the `ATIS_RELAY_KEY` environment variable; KDTW only; 2-min CDN cache)
- `scripts/deploy.py` — uploads `site/` and `netlify/functions/` to Netlify with the file-digest API (`--draft` for a preview)
- `tests/`, `package.json` — static checks and unit tests (`tests/fixtures/` holds saved FAA runway footprints) (`npm test`, Node 20+, no dependencies). Not scheduled; run on demand.
- `AGENTS.md`, `INTENT.md`, `SPEC.md`, `BACKLOG.md` — project docs for contributors and AI agents

## Deploy
Static site, no build step. The publish directory is `site/`.

```sh
npm test
pplx credentials run custom-cred:<netlify-credential> -- python3 scripts/deploy.py --draft   # preview
pplx credentials run custom-cred:<netlify-credential> -- python3 scripts/deploy.py           # production
curl -s https://aert2800wx.netlify.app/version.txt
```

The Netlify token comes from the credential store at run time; it is never stored in the repo. The ATIS Relay key lives only in Netlify (Site configuration → Environment variables → `ATIS_RELAY_KEY`, all contexts); rotate it there and on atisrelay.com together. If the repo is ever connected to Netlify's Git integration, set the publish directory to `site`.

`_redirects` must keep the `?` before `:splat` on the AWC rules (for example `metar?:splat`); the app calls `/awc/metar/ids=...&format=json` and the proxy has to turn that path into a query string.
