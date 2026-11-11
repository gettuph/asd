'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ctx, x } = require('./harness');
const { haversineNm, pointInPolygon, minDistToCoords, minDistToPolygon } = ctx;
const { BG_LAT, BG_LON, AIRPORTS } = x;

test('haversineNm: 1G0 to KTOL is about 14 nm, to KDTW about 44 nm', () => {
  const d1 = haversineNm(BG_LAT, BG_LON, 41.5868, -83.8078);
  const d2 = haversineNm(BG_LAT, BG_LON, 42.2124, -83.3534);
  assert.ok(d1 > 11 && d1 < 17, `KTOL ${d1}`);
  assert.ok(d2 > 40 && d2 < 55, `KDTW ${d2}`);
  assert.equal(haversineNm(BG_LAT, BG_LON, BG_LAT, BG_LON), 0);
});

// Big box around 1G0 whose corners are all >200 nm away (the G-AIRMET case that used to be dropped)
const bigBox = [{ lat: 38.4, lon: -86.6 }, { lat: 44.4, lon: -86.6 }, { lat: 44.4, lon: -80.6 }, { lat: 38.4, lon: -80.6 }];
// Box east of 1G0: west edge 1° of longitude away (~45 nm), corners far north/south
const eastBox = [{ lat: 38, lon: -82.63 }, { lat: 45, lon: -82.63 }, { lat: 45, lon: -78 }, { lat: 38, lon: -78 }];
// Small box far away
const farBox = [{ lat: 30, lon: -90 }, { lat: 31, lon: -90 }, { lat: 31, lon: -89 }, { lat: 30, lon: -89 }];

test('pointInPolygon', () => {
  assert.equal(pointInPolygon(BG_LAT, BG_LON, bigBox), true);
  assert.equal(pointInPolygon(BG_LAT, BG_LON, eastBox), false);
  assert.equal(pointInPolygon(BG_LAT, BG_LON, farBox), false);
  assert.equal(pointInPolygon(BG_LAT, BG_LON, []), false);
  assert.equal(pointInPolygon(BG_LAT, BG_LON, bigBox.map(p => ({ lat: String(p.lat), lon: String(p.lon) }))), true, 'string coords from AWC');
});

test('minDistToPolygon: inside → 0 even when every vertex is far away', () => {
  assert.ok(minDistToCoords(bigBox) > 200, 'vertex distance is large');
  assert.equal(minDistToPolygon(bigBox), 0);
});
test('minDistToPolygon: nearest edge, not nearest vertex', () => {
  const edge = minDistToPolygon(eastBox);
  assert.ok(edge > 43 && edge < 47, `edge distance ${edge}`);
  assert.ok(minDistToCoords(eastBox) > 200, 'vertex distance is large');
});
test('minDistToPolygon: far polygon stays far; empty → 99999', () => {
  assert.ok(minDistToPolygon(farBox) > 500);
  assert.equal(minDistToPolygon([]), 99999);
  assert.equal(minDistToPolygon(null), 99999);
});

test('AIRPORTS: unique ICAOs, plausible coordinates, valid groups, within 150 nm', () => {
  const seen = new Set();
  for (const a of AIRPORTS) {
    assert.match(a.icao, /^K[A-Z0-9]{3}$/, a.icao);
    assert.ok(!seen.has(a.icao), `duplicate ${a.icao}`); seen.add(a.icao);
    assert.ok(a.lat > 38 && a.lat < 44 && a.lon > -88 && a.lon < -80, `${a.icao} coords`);
    assert.ok(['local', 'area', 'region'].includes(a.group), `${a.icao} group ${a.group}`);
    assert.ok(haversineNm(BG_LAT, BG_LON, a.lat, a.lon) < 150, `${a.icao} too far`);
  }
  assert.equal(AIRPORTS.length, 15);
});
