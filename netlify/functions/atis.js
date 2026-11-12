// D-ATIS relay for the dashboard (Netlify Function, Lambda-compatible).
//
// Holds the ATIS Relay API key server-side (env ATIS_RELAY_KEY) so visitors never see or use it.
// Only airports in ALLOWED are relayed. The dashboard asks for ?icao=XXXX&b=N, where N is the current
// 5-minute time bucket (floor(unix seconds / BUCKET_S)). Only the current bucket (±1 for clock skew) is
// accepted, and each bucket's answer is cached on Netlify's CDN (durable, shared by all edge nodes), so
// ATIS Relay sees about one request per airport per 5 minutes no matter how many browsers ask or how
// often the Refresh button is pressed. Requests without b are cached for CACHE_S. ATIS Relay terms (https://atisrelay.com/api_docs): key kept
// secret; cache <= 24 h, no archive; warnings and status fields passed through unchanged; back off on
// 429 for at least Retry-After; descriptive User-Agent.
'use strict';

const ALLOWED = new Set(['KDTW']);
const BUCKET_S = 300;                  // one upstream fetch per airport per 5-minute bucket (Refresh lockout)
const CACHE_S = 300;                   // ATIS Relay: refetch no more than once per 1–2 min per airport (we use 5)
const BUCKET_CACHE_S = 2 * BUCKET_S;   // a bucket URL is cached past its window, so it is fetched only once
const UPSTREAM = 'https://atisrelay.com/api/atis';
const UA = 'ASD-BGSU/1.39 (+https://aert2800wx.netlify.app)';
const NS_KEY = /^xmlns(:|$)/;          // XML namespace noise in the SWIM records — dropped

let memo = {};                         // per warm instance: icao -> { t, status, body, headers }

function cacheHeaders(seconds) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, max-age=${Math.min(seconds, 60)}`,
    'Netlify-CDN-Cache-Control': `public, durable, s-maxage=${seconds}, stale-while-revalidate=60`,
  };
}

// Keep every field of a SWIM D-ATIS record except XML namespace declarations.
function cleanRecord(rec) {
  if (!rec || typeof rec !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(rec)) if (!NS_KEY.test(k)) out[k] = v;
  return out;
}

// Pass every top-level field through (official, notice, and anything ATIS Relay adds later),
// cleaning only the three record objects.
function shapeResponse(icao, data) {
  const out = { icao };
  for (const [k, v] of Object.entries(data || {})) {
    out[k] = (k === 'atis' || k === 'arrival' || k === 'departure') ? cleanRecord(v) : v;
  }
  if (!('notice' in out)) out.notice = 'Unofficial. Not for operational use. Confirm on frequency.';
  if (!('official' in out)) out.official = false;
  out.fetched_at = new Date().toISOString();
  out.source = 'ATIS Relay';
  return out;
}

function reply(status, body, headers) {
  return { statusCode: status, headers, body: JSON.stringify(body) };
}

exports.handler = async function handler(event) {
  const q = event.queryStringParameters || {};
  const icao = String(q.icao || '').trim().toUpperCase();
  if (!ALLOWED.has(icao)) return reply(400, { error: 'airport_not_supported' }, cacheHeaders(3600));

  // Time bucket: only the current 5-minute window is served, so cache-busting can't force extra fetches
  let okTtl = CACHE_S;
  if (q.b != null && q.b !== '') {
    const b = Number(q.b), cur = Math.floor(Date.now() / 1000 / BUCKET_S);
    if (!/^\d+$/.test(String(q.b)) || Math.abs(b - cur) > 1) {
      return reply(400, { error: 'bad_bucket', bucket: cur }, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    }
    okTtl = BUCKET_CACHE_S;
  }

  const key = process.env.ATIS_RELAY_KEY;
  if (!key) return reply(500, { error: 'not_configured' }, cacheHeaders(60));

  const hit = memo[icao];
  if (hit && Date.now() - hit.t < hit.ttl * 1000) {
    const left = Math.max(1, Math.round(hit.ttl - (Date.now() - hit.t) / 1000));
    return reply(hit.status, hit.body, cacheHeaders(left));   // the CDN copy expires with this one
  }

  let res;
  try {
    res = await fetch(`${UPSTREAM}?icao=${encodeURIComponent(icao)}`, {
      headers: { 'X-Api-Key': key, 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return reply(502, { error: 'upstream_unreachable' }, cacheHeaders(30));
  }

  if (res.status === 429) {
    const ra = Math.max(60, parseInt(res.headers.get('retry-after') || '60', 10) || 60);
    const body = { error: 'rate_limited', retry_after: ra };
    memo[icao] = { t: Date.now(), ttl: ra, status: 503, body };
    return reply(503, body, { ...cacheHeaders(ra), 'Retry-After': String(ra) });
  }
  if (res.status === 401 || res.status === 403) return reply(502, { error: 'upstream_auth' }, cacheHeaders(300));
  if (!res.ok) return reply(502, { error: 'upstream_error', status: res.status }, cacheHeaders(30));

  let data;
  try { data = await res.json(); } catch { return reply(502, { error: 'upstream_bad_json' }, cacheHeaders(30)); }

  const body = shapeResponse(icao, data);
  memo[icao] = { t: Date.now(), ttl: BUCKET_S, status: 200, body };
  return reply(200, body, cacheHeaders(okTtl));
};

// for tests
exports._internals = { ALLOWED, CACHE_S, BUCKET_S, UA, shapeResponse, cleanRecord, reset: () => { memo = {}; } };
