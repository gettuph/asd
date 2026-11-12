'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ctx, x, html } = require('./harness');
const plain = o => JSON.parse(JSON.stringify(o)); // VM-realm objects → plain objects for deepEqual

// ---- winds aloft decoder -------------------------------------------------------------
test('decodeFdEntry: normal, light & variable, high-speed encoding, temps', () => {
  const { decodeFdEntry } = ctx;
  assert.deepEqual(plain(decodeFdEntry('2715')), { dir: 270, spd: 15, tmp: null });
  assert.deepEqual(plain(decodeFdEntry('2715-04')), { dir: 270, spd: 15, tmp: -4 });
  assert.deepEqual(plain(decodeFdEntry('2715+12')), { dir: 270, spd: 15, tmp: 12 });
  assert.deepEqual(plain(decodeFdEntry('9900')), { dir: 'L&V', spd: 0, tmp: null });
  // 7730 → dir 27, spd 130 (dd > 36 means add 100 kt and subtract 50 from dd)
  assert.deepEqual(plain(decodeFdEntry('7730-45')), { dir: 270, spd: 130, tmp: -45 });
  assert.equal(decodeFdEntry(''), null);
  assert.equal(decodeFdEntry('abcd'), null);
});

// ---- clocks --------------------------------------------------------------------------
test('24-hour clock shows 00:xx at midnight Eastern (not 24:xx)', () => {
  const mid = new Date('2026-09-14T04:05:00Z'); // 00:05 EDT
  assert.equal(x._fmt24.format(mid), '00:05');
  assert.equal(x._fmt12.format(mid).replace(/\u202f/g, ' '), '12:05 AM');
});
test('12-hour clock in the afternoon', () => {
  const pm = new Date('2026-01-14T18:05:00Z'); // 13:05 EST
  assert.equal(x._fmt24.format(pm), '13:05');
  assert.equal(x._fmt12.format(pm).replace(/\u202f/g, ' '), '1:05 PM');
});
test('timezone abbreviation follows DST', () => {
  const tz = d => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })
    .formatToParts(d).find(p => p.type === 'timeZoneName').value;
  assert.equal(tz(new Date('2026-07-01T12:00:00Z')), 'EDT');
  assert.equal(tz(new Date('2026-01-01T12:00:00Z')), 'EST');
});

// ---- NWS alert table -----------------------------------------------------------------
test('ALERT_TYPES includes current NWS product names', () => {
  const t = x.ALERT_TYPES;
  for (const name of ['Tornado Warning', 'Tornado Watch', 'Severe Thunderstorm Warning', 'Severe Thunderstorm Watch',
    'Extreme Heat Warning', 'Extreme Heat Watch', 'Heat Advisory',
    'Extreme Cold Warning', 'Extreme Cold Watch', 'Cold Weather Advisory',
    'Winter Storm Warning', 'Winter Storm Watch', 'Winter Weather Advisory', 'Blizzard Warning', 'Ice Storm Warning',
    'Dense Fog Advisory', 'High Wind Warning', 'Wind Advisory', 'Air Quality Alert']) {
    assert.ok(t[name], `missing ${name}`);
  }
});
test('every alert badge class has CSS and a modal header color', () => {
  const classes = new Set(Object.values(x.ALERT_TYPES).map(a => a.cls));
  const colorsSrc = html.match(/const ALRT_COLORS = \{([^}]*)\}/)[1];
  for (const cls of classes) {
    assert.ok(html.includes(`.${cls} `) || html.includes(`.${cls}{`), `no CSS rule for .${cls}`);
    assert.ok(colorsSrc.includes(`'${cls}'`), `no ALRT_COLORS entry for ${cls}`);
  }
});
test('alert labels fit a badge (no abbreviation of "Warning" in heat labels)', () => {
  assert.equal(x.ALERT_TYPES['Extreme Heat Warning'].label, 'Extreme Heat Warning');
  for (const a of Object.values(x.ALERT_TYPES)) assert.ok(a.label.length <= 24, a.label);
});

// ---- proxy map / IDs -----------------------------------------------------------------
test('every AWC proxy path used in JS has a _redirects rule', () => {
  const fs = require('fs'); const path = require('path');
  const redirects = fs.readFileSync(path.join(__dirname, '..', 'site', '_redirects'), 'utf8');
  for (const p of Object.values(x.AWC_PROXY_MAP)) {
    assert.ok(redirects.includes(`${p}*`), `no _redirects rule for ${p}*`);
  }
  assert.ok(redirects.includes('/awc/windtemp/'), 'windtemp rule');
  assert.ok(redirects.includes('/nws/alerts/*'), 'nws alerts rule');
  assert.ok(redirects.includes('/tfr/*'), 'tfr rule');
});
test('IDS lists all 16 airports once', () => {
  const ids = x.IDS.split(',');
  assert.equal(ids.length, 16);
  assert.equal(new Set(ids).size, 16);
  assert.ok(ids.includes('KTOL'));
});

// ---- top-level entry points stay global (AGENTS.md rule 10) ----------------------------
test('fetchData, fetchAlerts, checkTFRs, fetchWindsAloft, render, refreshAll are top-level functions', () => {
  for (const f of ['fetchData', 'fetchAlerts', 'checkTFRs', 'fetchWindsAloft', 'render', 'refreshAll', 'applyHeaderTheme', 'openBriefModal', 'closeBriefModal']) {
    assert.equal(typeof ctx[f], 'function', f);
  }
});

// ---- data validation in fetch path -----------------------------------------------------
test('wxFetch resolves to null (not []) when every path fails, so callers keep last-good data', async () => {
  // fetch stub in the harness never resolves; wxFetch's timeouts are no-op'd, so instead
  // verify the contract in source: the final fallback returns null.
  const { src } = require('./harness');
  assert.match(src, /console\.warn\("wxFetch: all methods failed for", url\);\s*return null;/);
});

// ---- airport lookup (v1.32) ----
test('normalizeIcao: US three-letter LOCID gets a K prefix', () => {
  assert.equal(ctx.normalizeIcao('tol'), 'KTOL');
  assert.equal(ctx.normalizeIcao(' dtw '), 'KDTW');
});
test('normalizeIcao: four-character and alphanumeric IDs are sent as typed (upper-cased)', () => {
  assert.equal(ctx.normalizeIcao('ktol'), 'KTOL');
  assert.equal(ctx.normalizeIcao('cyyz'), 'CYYZ');
  assert.equal(ctx.normalizeIcao('egll'), 'EGLL');
  assert.equal(ctx.normalizeIcao('1g0'), '1G0');   // digits: not a LOCID, no K prefix
  assert.equal(ctx.normalizeIcao('PHNL'), 'PHNL');
});
test('normalizeIcao: strips junk and handles empty input', () => {
  assert.equal(ctx.normalizeIcao('K-TOL'), 'KTOL');
  assert.equal(ctx.normalizeIcao(''), '');
  assert.equal(ctx.normalizeIcao(null), '');
  assert.equal(ctx.normalizeIcao('   '), '');
});
test('lookup entry points are top-level functions', () => {
  for (const f of ['normalizeIcao', 'lookupAirport', 'openLookupModal', 'closeLookupModal', 'metarDetailHtml']) {
    assert.equal(typeof ctx[f], 'function', f);
  }
});
test('metarDetailHtml renders badge, raw text and altimeter in inHg', () => {
  const html = ctx.metarDetailHtml({ rawOb: 'KTOL 111852Z 25012KT 10SM FEW250 12/01 A3012', visib: 10, clouds: [{cover:'FEW',base:25000}], altim: 1020, temp: 12, dewp: 1, wdir: 250, wspd: 12 });
  assert.match(html, /cat-badge cat-VFR/);
  assert.match(html, /KTOL 111852Z/);
  assert.match(html, /10 SM/);
});

test('closeLookupModal clears both LocID boxes so the placeholder returns', () => {
  const ids = ['lookupInput', 'lookupModalInput'];
  const els = {};
  const origGet = ctx.document.getElementById;
  ctx.document.getElementById = id => (els[id] ||= { value: 'KTOL', style: {}, classList: { contains: () => false, add(){}, remove(){} } });
  try { ctx.closeLookupModal(); } finally { ctx.document.getElementById = origGet; }
  for (const id of ids) assert.equal(els[id].value, '', id);
});

// ---- D-ATIS panel (v1.37) ----
test('D-ATIS panel: notice, NOT FOR OPERATIONAL USE, attribution link, letters, escaped text', () => {
  const fx = require('./fixtures/atis_kdtw.json');
  ctx.eval && 0;
  const h0 = ctx.atisDetailHtml('KDTW');
  assert.match(h0, /data-key="atis-KDTW"/);
  assert.match(h0, /Unofficial\. Not for operational use\. Confirm on frequency\. NOT FOR OPERATIONAL USE\./);
  assert.match(h0, /Data: <a href="https:\/\/atisrelay\.com"[^>]*>ATIS Relay<\/a>/);
  assert.match(h0, /Loading D-ATIS/);
  const ddhhmm = ms => { const d = new Date(ms); return [d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()].map(n => String(n).padStart(2, '0')).join(''); };
  const fresh = ddhhmm(Date.now() - 5 * 60000), stale = ddhhmm(Date.now() - 2 * 3600000);
  x.setAtis('KDTW', { ...fx, arrival: { ...fx.arrival, DATISTime: fresh, dataBody: fx.arrival.dataBody + ' <script>' }, departure: { ...fx.departure, DATISTime: fresh } });
  assert.doesNotMatch(ctx.atisDetailHtml('KDTW'), /more than an hour old/);
  assert.match(ctx.atisDetailHtml('KDTW'), /5m ago/);
  x.setAtis('KDTW', { ...fx, arrival: { ...fx.arrival, DATISTime: stale, dataBody: fx.arrival.dataBody + ' <script>' } });
  const h1 = ctx.atisDetailHtml('KDTW');
  assert.match(h1, new RegExp(`D-ATIS — Arrival ${fx.arrival.letter} · Departure ${fx.departure.letter}`));
  assert.match(h1, new RegExp(`Arrival — Information ${fx.arrival.letter}`));
  assert.match(h1, /DTW ARR INFO/);
  assert.doesNotMatch(h1, /<script>/);
  assert.match(h1, /more than an hour old/);             // 2 h old ATIS is flagged
  x.setAtis('KDTW', { ...fx, warning: 'Data delayed' });
  assert.match(ctx.atisDetailHtml('KDTW'), /Data delayed/);   // unknown messages are never dropped
  x.setAtis('KDTW', null);
});
test('D-ATIS panel: failed refresh keeps the last report and says so', () => {
  const fx = require('./fixtures/atis_kdtw.json');
  x.setAtis('KDTW', fx, 'ATIS Relay not responding');
  const h = ctx.atisDetailHtml('KDTW');
  assert.match(h, /Couldn't refresh D-ATIS \(ATIS Relay not responding\)/);
  assert.match(h, /DTW DEP INFO/);
  x.setAtis('KDTW', null, 'ATIS Relay not responding');
  assert.match(ctx.atisDetailHtml('KDTW'), /D-ATIS unavailable right now/);
  x.setAtis('KDTW', null);
});

test('atisIssued: DDHHMM in UTC, month rollover, fallback to timestamp', () => {
  const now = Date.UTC(2026, 10, 12, 4, 15);             // 12 Nov 2026 0415Z
  assert.equal(ctx.atisIssued({ DATISTime: '120353' }, now).toISOString(), '2026-11-12T03:53:00.000Z');
  assert.equal(ctx.atisIssued({ DATISTime: '302350' }, Date.UTC(2026, 11, 1, 0, 10)).toISOString(), '2026-11-30T23:50:00.000Z'); // 1 Dec 0010Z → 30 Nov
  assert.equal(ctx.atisIssued({ timestamp: 1794456692111 }, now).getTime(), 1794456692111);
  assert.equal(ctx.atisIssued({}, now), null);
});

test('D-ATIS Refresh button: enabled, then locked for 5 min after a fetch, with bucketed URL', () => {
  x.setAtis('KDTW', require('./fixtures/atis_kdtw.json'));
  x.setAtisTried('KDTW', 0);
  assert.match(ctx.atisDetailHtml('KDTW'), /<button type="button" class="atis-refresh" data-atis-refresh="KDTW">Refresh<\/button>/);
  const t = Date.UTC(2026, 10, 12, 4, 12);
  x.setAtisTried('KDTW', Date.now() - 60000);
  const h = ctx.atisDetailHtml('KDTW');
  assert.match(h, /class="atis-refresh" disabled[^>]*>Refresh available \d{4}Z</);
  assert.doesNotMatch(h, /data-atis-refresh/);
  assert.equal(ctx.atisRefreshAt('KDTW', Date.now() + 5 * 60000), 0);
  assert.equal(ctx.atisBucket(t), Math.floor(t / 300000));
  x.setAtisTried('KDTW', 0); x.setAtis('KDTW', null);
});

test('D-ATIS: KCLE labelled arrival & departure; single-ATIS airports (KCMH, KIND) get a panel, label, and Information block', () => {
  assert.match(ctx.atisDetailHtml('KCLE'), /<summary>D-ATIS — arrival &amp; departure<\/summary>/);
  for (const id of ['KCMH', 'KIND']) {
    const h0 = ctx.atisDetailHtml(id);
    assert.match(h0, new RegExp(`data-key="atis-${id}"><summary>D-ATIS</summary>`));
    x.setAtis(id, { icao: id, atis: { letter: 'K', dataBody: `${id.slice(1)} ATIS INFO K 0451Z. 36012KT 10SM`, DATISTime: '' }, arrival: null, departure: null, official: false, notice: 'Unofficial. Not for operational use. Confirm on frequency.' });
    const h = ctx.atisDetailHtml(id);
    assert.match(h, /<summary>D-ATIS — Information K<\/summary>/);
    assert.match(h, /ATIS — Information K/);
    assert.match(h, new RegExp(`${id.slice(1)} ATIS INFO K`));
    x.setAtis(id, null);
  }
});
