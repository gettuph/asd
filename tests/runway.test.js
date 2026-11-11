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

// ---- Runway wind sketch (v1.35) ------------------------------------------------------
const { runwayEnds, bestRunwayEnd, skPt, skLabelLayout, runwaySketchSvg } = ctx;
const KTOL = RUNWAYS.KTOL, KFWA = RUNWAYS.KFWA;

test('runwayEnds lists both ends of every runway', () => {
  const ends = plain(runwayEnds(KTOL));
  assert.deepEqual(ends.map(e => e.name), ['07', '25', '16', '34']);
  assert.equal(ends[1].hdg, 247);
});

test('bestRunwayEnd: greatest headwind wins; ties go to the smaller crosswind; calm/VRB give null', () => {
  const ends = runwayEnds(KTOL);
  assert.equal(bestRunwayEnd(ends, 250, 12), '25');
  assert.equal(bestRunwayEnd(ends, 60, 12), '07');
  assert.equal(bestRunwayEnd(ends, 340, 10), '34');
  assert.equal(bestRunwayEnd(ends, 250, 0), null);
  assert.equal(bestRunwayEnd(ends, 'VRB', 5), null);
  // wind exactly between 07 (67°) and 16 (157°) at 112°: equal headwind, equal crosswind → first listed
  assert.equal(bestRunwayEnd(ends, 112, 10), '07');
});

test('skPt: north-up geometry (000 is up, 090 is right)', () => {
  const n = plain(skPt(0, 50)), e = plain(skPt(90, 50)), s = plain(skPt(180, 50));
  assert.ok(Math.abs(n.x - x.SK.cx) < 1e-9 && n.y < x.SK.cy);
  assert.ok(e.x > x.SK.cx && Math.abs(e.y - x.SK.cy) < 1e-9);
  assert.ok(s.y > x.SK.cy);
});

test('skLabelLayout: near-vertical ends stack above/below, others sit beside', () => {
  assert.deepEqual(plain(skLabelLayout(0)),   { anchor: 'middle', pos: 'top' });
  assert.deepEqual(plain(skLabelLayout(16)),  { anchor: 'middle', pos: 'top' });
  assert.deepEqual(plain(skLabelLayout(180)), { anchor: 'middle', pos: 'bottom' });
  assert.deepEqual(plain(skLabelLayout(67)),  { anchor: 'start',  pos: 'side' });
  assert.deepEqual(plain(skLabelLayout(247)), { anchor: 'end',    pos: 'side' });
});

test('runwaySketchSvg: every end labelled with Headwind/Tailwind and XW, favored end highlighted, arrow drawn', () => {
  const svg = runwaySketchSvg(KTOL, { wdir: 250, wspd: 12, wgst: 20 });
  for (const d of ['07', '25', '16', '34']) assert.match(svg, new RegExp(`>${d}<`));
  assert.match(svg, /Wind 250° at 12 kt, gusting 20 kt/);
  assert.match(svg, /Headwind 12 kt/);            // Rwy 25: 3° off the nose
  assert.match(svg, /Tailwind 12 kt/);            // Rwy 07
  assert.match(svg, /XW 12 kt L/);                // Rwy 34: 87° off → full crosswind, from the left
  assert.equal((svg.match(/sk-wind-head/g) || []).length, 1);
  assert.match(svg, /class="sk-pill"/);
  assert.match(svg, /class="sk-rwy best"/);
  assert.doesNotMatch(svg, /✓|✔/);
  assert.equal((svg.match(/<line class="sk-rwy/g) || []).length, 2);
});

test('runwaySketchSvg: calm and variable draw runways and designators only (no arrow, no components, no pill)', () => {
  for (const m of [{ wdir: 0, wspd: 0 }, { wdir: 'VRB', wspd: 4 }, null]) {
    const svg = runwaySketchSvg(KTOL, m);
    assert.match(svg, />07</);
    assert.doesNotMatch(svg, /sk-wind-head|Headwind|Tailwind|XW |sk-pill/);
  }
  assert.match(runwaySketchSvg(KTOL, { wdir: 0, wspd: 0 }), /Wind calm/);
  assert.match(runwaySketchSvg(KTOL, { wdir: 'VRB', wspd: 4 }), /Wind variable at 4 kt/);
});

test('runwaySketchSvg: three-runway airport keeps every label inside the viewBox', () => {
  const svg = runwaySketchSvg(KFWA, { wdir: 90, wspd: 15 });
  const xs = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.equal(xs.length, 2 + 6 * 3);
  for (const [px, py] of xs) { assert.ok(px >= 0 && px <= x.SK.w, `x ${px}`); assert.ok(py >= 10 && py <= x.SK.h, `y ${py}`); }
  assert.equal((svg.match(/<line class="sk-rwy/g) || []).length, 3);
});

test('runwaySketchSvg escapes designators', () => {
  const svg = runwaySketchSvg([{ le: '<b>', he: '18', le_hdg: 0, he_hdg: 180, len: 5000 }], { wdir: 0, wspd: 0 });
  assert.doesNotMatch(svg, /<b>/);
  assert.match(svg, /&lt;b&gt;/);
});
