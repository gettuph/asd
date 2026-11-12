'use strict';
// Netlify Function netlify/functions/atis.js — exercised with a fake fetch; nothing leaves the machine.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fixture = require('./fixtures/atis_kdtw.json');
const fn = require(path.join(__dirname, '..', 'netlify', 'functions', 'atis.js'));

function fakeFetch(status, body, headers = {}) {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url, opts });
    return { status, ok: status >= 200 && status < 300, headers: { get: k => headers[k.toLowerCase()] ?? null }, json: async () => body };
  };
  f.calls = calls;
  return f;
}
async function call(icao, { status = 200, body = fixture, headers = {}, key = 'test-key', b } = {}) {
  fn._internals.reset();
  const saved = { fetch: global.fetch, key: process.env.ATIS_RELAY_KEY };
  global.fetch = fakeFetch(status, body, headers);
  if (key == null) delete process.env.ATIS_RELAY_KEY; else process.env.ATIS_RELAY_KEY = key;
  try {
    const qs = icao == null ? {} : { icao };
    if (b != null) qs.b = String(b);
    const res = await fn.handler({ queryStringParameters: qs });
    return { res, json: JSON.parse(res.body), calls: global.fetch.calls };
  } finally { global.fetch = saved.fetch; if (saved.key == null) delete process.env.ATIS_RELAY_KEY; else process.env.ATIS_RELAY_KEY = saved.key; }
}

test('relays KDTW: key in the X-Api-Key header, descriptive User-Agent, key never in the response', async () => {
  const { res, json, calls } = await call('kdtw');
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://atisrelay.com/api/atis?icao=KDTW');
  assert.equal(calls[0].opts.headers['X-Api-Key'], 'test-key');
  assert.match(calls[0].opts.headers['User-Agent'], /^ASD-BGSU\/\d+\.\d+ \(\+https:\/\/aert2800wx\.netlify\.app\)$/);
  assert.doesNotMatch(res.body, /test-key/);
});

test('passes arrival/departure text, letters, notice and official through; drops only xmlns noise', async () => {
  const { json } = await call('KDTW');
  assert.equal(json.arrival.letter, fixture.arrival.letter);
  assert.equal(json.departure.letter, fixture.departure.letter);
  assert.equal(json.arrival.dataBody, fixture.arrival.dataBody);
  assert.equal(json.notice, 'Unofficial. Not for operational use. Confirm on frequency.');
  assert.equal(json.official, false);
  assert.ok(!Object.keys(json.arrival).some(k => k.startsWith('xmlns')));
  assert.equal(json.arrival.timestamp, fixture.arrival.timestamp);
});

test('unknown top-level fields from ATIS Relay (future warnings) are kept', async () => {
  const { json } = await call('KDTW', { body: { ...fixture, warning: 'Data delayed' } });
  assert.equal(json.warning, 'Data delayed');
});

test('cache: shared durable CDN cache for 5 min, never longer than 24 h', async () => {
  const { res } = await call('KDTW');
  assert.match(res.headers['Netlify-CDN-Cache-Control'], /public, durable, s-maxage=300/);
  const s = Number(/s-maxage=(\d+)/.exec(res.headers['Netlify-CDN-Cache-Control'])[1]);
  assert.ok(s > 0 && s <= 86400);
});

test('allow-list: KDTW, KCLE, KCMH, KIND are relayed', async () => {
  for (const id of ['KDTW', 'KCLE', 'kcmh', 'KIND']) {
    const { res, calls } = await call(id);
    assert.equal(res.statusCode, 200, id);
    assert.equal(calls[0].url, `https://atisrelay.com/api/atis?icao=${id.toUpperCase()}`);
  }
});

test('only allow-listed airports: anything else is refused without calling ATIS Relay', async () => {
  for (const id of ['KORD', '1G0', '', null, 'KDTW,KORD']) {
    const { res, json, calls } = await call(id);
    assert.equal(res.statusCode, 400, String(id));
    assert.equal(json.error, 'airport_not_supported');
    assert.equal(calls.length, 0);
  }
});

test('missing key: 500 not_configured and no upstream call', async () => {
  const { res, json, calls } = await call('KDTW', { key: null });
  assert.equal(res.statusCode, 500);
  assert.equal(json.error, 'not_configured');
  assert.equal(calls.length, 0);
});

test('429: waits at least Retry-After (and at least 60 s), cached for that long', async () => {
  const { res, json } = await call('KDTW', { status: 429, body: {}, headers: { 'retry-after': '300' } });
  assert.equal(res.statusCode, 503);
  assert.equal(json.error, 'rate_limited');
  assert.equal(res.headers['Retry-After'], '300');
  assert.match(res.headers['Netlify-CDN-Cache-Control'], /s-maxage=300/);
  const short = await call('KDTW', { status: 429, body: {}, headers: { 'retry-after': '5' } });
  assert.equal(short.res.headers['Retry-After'], '60');
});

test('auth failure and upstream errors are reported without detail leakage', async () => {
  assert.equal((await call('KDTW', { status: 401, body: {} })).json.error, 'upstream_auth');
  assert.equal((await call('KDTW', { status: 500, body: {} })).json.error, 'upstream_error');
});

test('warm instance reuses its response instead of calling ATIS Relay again', async () => {
  fn._internals.reset();
  const saved = global.fetch; process.env.ATIS_RELAY_KEY = 'k';
  global.fetch = fakeFetch(200, fixture);
  try {
    await fn.handler({ queryStringParameters: { icao: 'KDTW' } });
    await fn.handler({ queryStringParameters: { icao: 'KDTW' } });
    assert.equal(global.fetch.calls.length, 1);
  } finally { global.fetch = saved; delete process.env.ATIS_RELAY_KEY; }
});

const curBucket = () => Math.floor(Date.now() / 1000 / fn._internals.BUCKET_S);
test('time bucket: current window (±1) served and cached past its window; others refused without an upstream call', async () => {
  for (const b of [curBucket(), curBucket() - 1, curBucket() + 1]) {
    const { res, calls } = await call('KDTW', { b });
    assert.equal(res.statusCode, 200, String(b));
    assert.equal(calls.length, 1);
    assert.match(res.headers['Netlify-CDN-Cache-Control'], /s-maxage=600/);
  }
  for (const b of [curBucket() + 5, curBucket() - 2, 0, 'abc', '1e9', '-1']) {
    const { res, json, calls } = await call('KDTW', { b });
    assert.equal(res.statusCode, 400, String(b));
    assert.equal(json.error, 'bad_bucket');
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(calls.length, 0);
  }
});

test('Refresh lockout on the server: a new bucket inside 5 min reuses the warm copy', async () => {
  fn._internals.reset();
  const saved = global.fetch; process.env.ATIS_RELAY_KEY = 'k';
  global.fetch = fakeFetch(200, fixture);
  try {
    await fn.handler({ queryStringParameters: { icao: 'KDTW', b: String(curBucket()) } });
    const r = await fn.handler({ queryStringParameters: { icao: 'KDTW', b: String(curBucket() + 1) } });
    assert.equal(global.fetch.calls.length, 1);
    const s = Number(/s-maxage=(\d+)/.exec(r.headers['Netlify-CDN-Cache-Control'])[1]);
    assert.ok(s <= 300 && s > 0, String(s));
  } finally { global.fetch = saved; delete process.env.ATIS_RELAY_KEY; }
});
