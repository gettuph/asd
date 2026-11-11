#!/usr/bin/env node
// Static checks for the Aviation Situation Dashboard. No network, no browser.
// Exit code 1 if any check fails. Run: `node tests/static-checks.js` (or `npm test`).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'site');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');
const redirects = read('_redirects');
const versionTxt = read('version.txt').trim();
const manifest = JSON.parse(read('manifest.json'));

const failures = [];
const passes = [];
function check(name, ok, detail = '') { (ok ? passes : failures).push(name + (detail && !ok ? ` — ${detail}` : '')); }

// ---- 1. the inline script parses ----------------------------------------------------
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
check('exactly one inline <script>', scripts.length === 1, `found ${scripts.length}`);
const src = scripts[0] || '';
try { new vm.Script(src, { filename: 'index.html#script' }); check('inline script parses (syntax)', true); }
catch (e) { check('inline script parses (syntax)', false, e.message); }

// ---- 2. version consistency -----------------------------------------------------------
const verConst = (src.match(/const CURRENT_VERSION = "(v\d+\.\d+)"/) || [])[1];
const verTitle = (html.match(/<title>Aviation Situation Dashboard (v\d+\.\d+)<\/title>/) || [])[1];
const verSmall = (html.match(/>(v\d+\.\d+)&ensp;/) || [])[1];
check('version.txt is vMAJOR.MINOR', /^v\d+\.\d+$/.test(versionTxt), versionTxt);
check('CURRENT_VERSION == version.txt', verConst === versionTxt, `${verConst} vs ${versionTxt}`);
check('<title> version == version.txt', verTitle === versionTxt, `${verTitle} vs ${versionTxt}`);
check('header version label == version.txt', verSmall === versionTxt, `${verSmall} vs ${versionTxt}`);

// ---- 3. safety disclaimers, word for word, main page + briefing view -------------------
const DISCLAIMER = 'This information is for situational awareness only. It must not be used for official flight planning. Always obtain a proper weather briefing through approved sources.';
const disclaimerCount = html.split(DISCLAIMER).length - 1;
check('disclaimer present at least twice (page banner + briefing view)', disclaimerCount >= 2, `found ${disclaimerCount}`);
const briefBlock = html.slice(html.indexOf('id="briefModal"'), html.indexOf('class="brief-head"'));
check('disclaimer is the first thing inside the briefing view', briefBlock.includes(DISCLAIMER));

// ---- 4. removed features must stay removed (AGENTS.md rule 2) ----------------------------
for (const [label, re] of [
  ['classroomMode / classroom tips', /classroomMode|classroom tip/i],
  ['lightning sky flash', /flashAlpha|Sky-flash/],
  ['callouts', /generateCallouts|class="callout/],
  ['per-airport NOTAM links', /notam-entry|notams\.aim\.faa\.gov/i],
]) check(`no ${label}`, !re.test(html));

// ---- 5. no autoplay (AGENTS.md rule 7) -------------------------------------------------
check('no cavuwx iframe in static HTML (created only on click)', !/<iframe[^>]*cavuwx/i.test(html));
check('pre-duty load button exists', /id="predutyLoadBtn"/.test(html));
check('no allow="autoplay" anywhere', !/allow="[^"]*autoplay(?!\s*'none')/i.test(html));

// ---- 6. classroom controls (AGENTS.md rule 8) -----------------------------------------
const controls = html.slice(html.indexOf('<div class="controls">'), html.indexOf('</header>'));
const order = ['id="briefBtn"', 'id="fullscreenBtn"', 'id="themeToggle"', 'id="refreshBtn"'].map(s => controls.indexOf(s));
check('header buttons in order: briefing, fullscreen, theme, refresh', order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])));
check('briefing + fullscreen buttons are dimmed (opacity 0.55)', (controls.match(/style="opacity:0\.55"/g) || []).length === 2);

// ---- 7. Mobile Safari rules (AGENTS.md rule 9) -----------------------------------------
const headerCss = ((html.match(/\.header\s*\{[^}]*\}/) || [''])[0]).replace(/\/\*[\s\S]*?\*\//g, '');
check('.header does not combine position:sticky with overflow:hidden', !(/position:\s*sticky/.test(headerCss) && /overflow:\s*hidden/.test(headerCss)));
const briefImgCss = (html.match(/\.brief-pane \.pb\.img img\s*\{[^}]*\}/) || [''])[0];
check('briefing images are absolutely positioned (not height:100% in flow)', /position:\s*absolute/.test(briefImgCss));
check('briefing grid tracks have zero minimum (minmax(0,1fr))', /\.brief-grid\s*\{[^}]*minmax\(0,1fr\)/.test(html));
check('scrolling briefing layouts use max-content rows', !/grid-auto-rows:\s*auto/.test(html));

// ---- 8. weather logic reads the METAR body only (AGENTS.md rule 3) ----------------------
check("header theme splits rawOb at ' RMK ' before weather checks", /const rxBody = \(m\?\.rawOb \|\| ''\)\.split\(' RMK '\)\[0\]/.test(src));
check('no stray rawBody identifier (v1.19 typo)', !/\brawBody\b/.test(src));

// ---- 9. DOM ids referenced in JS exist in HTML (or are created dynamically) -------------
const DYNAMIC_IDS = new Set(['ptrArrow', 'ptrText', 'predutyFrame', 'radarImg', 'progImg', 'spcImg', 'radarCaption', 'progCaption',
  'radarTabs', 'progTabs', 'tfrMapDiv', 'briefProg', 'briefRadar']);
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const jsIds = new Set([...src.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
const missing = [...jsIds].filter(id => !htmlIds.has(id) && !DYNAMIC_IDS.has(id));
check('every getElementById target exists in HTML', missing.length === 0, missing.join(', '));
const dupIds = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) !== i);
check('no duplicate static ids', dupIds.length === 0, [...new Set(dupIds)].join(', '));

// ---- 10. _redirects proxy rules --------------------------------------------------------
for (const p of ['metar', 'taf', 'pirep', 'airsigmet', 'gairmet']) {
  const re = new RegExp(`^/awc/${p}/\\*\\s+https://aviationweather\\.gov/api/data/${p}\\?:splat\\s+200`, 'm');
  check(`_redirects: /awc/${p}/* keeps the "?" before :splat`, re.test(redirects));
}
check('_redirects: windtemp rule', /^\/awc\/windtemp\/\s+https:\/\/aviationweather\.gov\/api\/data\/windtemp\s+200/m.test(redirects));
check('_redirects: NWS alerts rule', /^\/nws\/alerts\/\*\s+https:\/\/api\.weather\.gov\/alerts\/:splat\s+200/m.test(redirects));
check('_redirects: TFR rule', /^\/tfr\/\*\s+https:\/\/tfr\.faa\.gov\/:splat\s+200/m.test(redirects));
for (const p of ['/awc/metar/', '/awc/taf/', '/awc/pirep/', '/awc/airsigmet/', '/awc/gairmet/', '/awc/windtemp/', '/nws/alerts/', '/tfr/']) {
  check(`JS uses proxy path ${p}`, src.includes(`"${p}`) || src.includes(`'${p}`) || src.includes('`' + p) || src.includes(`(\`${p}`) || src.includes(p));
}

// ---- 11. manifest / icons ---------------------------------------------------------------
for (const icon of manifest.icons || []) check(`manifest icon exists: ${icon.src}`, fs.existsSync(path.join(ROOT, icon.src)));
for (const f of ['favicon.svg', 'icon-32.png', 'icon-180.png', 'icon-192.png', 'icon-512.png']) check(`file present: ${f}`, fs.existsSync(path.join(ROOT, f)));

// ---- 12. no secrets (AGENTS.md rule 11) --------------------------------------------------
const REPO = path.join(__dirname, '..');
const textFile = f => /\.(html|js|py|md|json|txt)$/.test(f) || f === '_redirects';
const tracked = [];
for (const dir of ['', 'site', 'scripts', 'tests']) {
  const abs = path.join(REPO, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    const rel = dir ? `${dir}/${f}` : f;
    if (textFile(f) && fs.statSync(path.join(REPO, rel)).isFile()) tracked.push(rel);
  }
}
for (const f of tracked) {
  const t = fs.readFileSync(path.join(REPO, f), 'utf8');
  check(`no Netlify token in ${f}`, !/nfp_[A-Za-z0-9]{20,}/.test(t) && !/Bearer [A-Za-z0-9_-]{30,}/.test(t));
}

// ---- 13. housekeeping --------------------------------------------------------------------
check('no console.log left in script', !/console\.log\(/.test(src));
check('no third-party proxy preconnects', !/preconnect[^>]*(codetabs|allorigins)/.test(html));
check('altimeter shown in inches of mercury', /inHg\.toFixed\(2\)\}" Hg/.test(src));
check('runway wind text spells out Headwind/Tailwind (no checkmarks)', !/✓|✔|&#10003;/.test(src.slice(src.indexOf('Runway wind components'), src.indexOf('Runway wind components') + 4000)));

// ---- report -----------------------------------------------------------------------------
for (const p of passes) console.log('  ok   ' + p);
for (const f of failures) console.log('  FAIL ' + f);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
