'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ctx, x } = require('./harness');
const plain = o => JSON.parse(JSON.stringify(o)); // VM-realm objects → plain objects for deepEqual
const { windComponents, rwyWindAnalysis } = ctx;
const { RUNWAYS, AIRPORTS } = x;

test('windComponents: 30° off the nose', () => {
  // wind 100/20 on runway 070: 30° right → HW 17, XW 10 from the right
  const c = windComponents(100, 20, 70);
  assert.deepEqual(plain(c), { headwind: 17, crosswind: 10, tailwind: false, side: 'R' });
});
test('windComponents: 30° off the nose from the left', () => {
  const c = windComponents(40, 20, 70);
  assert.deepEqual(plain(c), { headwind: 17, crosswind: 10, tailwind: false, side: 'L' });
});
test('windComponents: direct headwind, direct crosswind, direct tailwind', () => {
  assert.deepEqual(plain(windComponents(70, 15, 70)), { headwind: 15, crosswind: 0, tailwind: false, side: 'R' });
  const x90 = windComponents(160, 15, 70);
  assert.equal(x90.headwind, 0); assert.equal(x90.crosswind, 15); assert.equal(x90.tailwind, false);
  const tail = windComponents(250, 15, 70);
  assert.equal(tail.headwind, 15); assert.equal(tail.crosswind, 0); assert.equal(tail.tailwind, true);
});
test('windComponents: wraps across 360', () => {
  const c = windComponents(350, 10, 10); // 20° left of runway 01
  assert.equal(c.headwind, 9); assert.equal(c.crosswind, 3); assert.equal(c.side, 'L'); assert.equal(c.tailwind, false);
});
test('windComponents: calm / missing', () => {
  assert.deepEqual(plain(windComponents(0, 0, 70)), { headwind: 0, crosswind: 0, tailwind: false, side: '' });
  assert.deepEqual(plain(windComponents(null, null, 70)), { headwind: 0, crosswind: 0, tailwind: false, side: '' });
});

test('rwyWindAnalysis picks the end without a tailwind', () => {
  const rwy = { le: '07', he: '25', le_hdg: 67, he_hdg: 247, len: 10600 };
  assert.equal(rwyWindAnalysis(rwy, 250, 12).rwy, '25');
  assert.equal(rwyWindAnalysis(rwy, 60, 12).rwy, '07');
});

// ---- RUNWAYS table sanity ------------------------------------------------------------
test('RUNWAYS: reciprocal headings differ by 180 and designators match headings', () => {
  for (const [icao, rwys] of Object.entries(RUNWAYS)) {
    for (const r of rwys) {
      const diff = ((r.he_hdg - r.le_hdg) % 360 + 360) % 360;
      assert.ok(Math.abs(diff - 180) <= 1, `${icao} ${r.le}/${r.he}: headings ${r.le_hdg}/${r.he_hdg}`);
      // designator (tens of degrees, magnetic) should be within ~2 numbers of the true heading / 10
      const num = s => parseInt(s.replace(/[LRC]/, ''), 10);
      for (const [d, h] of [[r.le, r.le_hdg], [r.he, r.he_hdg]]) {
        const dd = Math.min(Math.abs(num(d) * 10 - h), 360 - Math.abs(num(d) * 10 - h));
        assert.ok(dd <= 25, `${icao} rwy ${d} vs heading ${h}`);
      }
      assert.ok(r.len > 1500 && r.len < 15000, `${icao} ${r.le}/${r.he} length ${r.len}`);
    }
  }
});
test('every airport with runway data is in AIRPORTS', () => {
  const ids = new Set(AIRPORTS.map(a => a.icao));
  for (const icao of Object.keys(RUNWAYS)) assert.ok(ids.has(icao), icao);
});
