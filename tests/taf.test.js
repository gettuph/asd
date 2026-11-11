'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ctx } = require('./harness');
const { tafLineCat, colorTaf } = ctx;

// Flight category thresholds (FAA): LIFR < 1 SM or < 500 ft; IFR 1–<3 SM or 500–<1000 ft;
// MVFR 3–5 SM or 1000–3000 ft; VFR > 5 SM and > 3000 ft.
const cases = [
  // The v1.23 bug: "1320 1/2SM" was read as 1320.5 SM → VFR. Fraction after a time group.
  // These cases have NO ceiling so the visibility alone must decide the category.
  ['TEMPO 1318/1320 1/2SM FG', 'LIFR'],
  ['TEMPO 1318/1320 1/2SM FG BKN003', 'LIFR'],
  ['BECMG 1400/1402 3/4SM BR', 'LIFR'],
  ['BECMG 1400/1402 2SM BR', 'IFR'],
  ['PROB30 1406/1410 1SM -SN BR', 'IFR'],
  ['PROB30 1406/1410 4SM -SN BR', 'MVFR'],
  ['TEMPO 1318/1320 1 1/2SM BR', 'IFR'],
  // "M" prefix = less than (old regex matched "4SM" out of "M1/4SM" → MVFR)
  ['FM131800 M1/4SM FG', 'LIFR'],
  ['FM131800 M1/4SM FG VV002', 'LIFR'],
  // Mixed numbers
  ['FM140000 1 1/2SM BR OVC008', 'IFR'],
  ['FM140000 2 1/2SM -RA BKN015', 'IFR'],
  // Whole numbers and P6SM
  ['FM140000 3SM -RA BKN012', 'MVFR'],
  ['FM140600 5SM BR BKN030', 'MVFR'],
  ['FM140600 6SM BR BKN035', 'VFR'],
  ['FM131800 P6SM SCT250', 'VFR'],
  // Ceiling-driven categories
  ['FM131800 P6SM BKN030', 'MVFR'],
  ['FM131800 P6SM BKN031', 'VFR'],
  ['FM131800 P6SM OVC009', 'IFR'],
  ['FM131800 P6SM OVC004', 'LIFR'],
  ['FM131800 P6SM VV002', 'LIFR'],
  // Lowest layer wins
  ['FM131800 P6SM SCT008 BKN025 OVC040', 'MVFR'],
  // Header line
  ['TAF KTOL 131720Z 1318/1418 24010KT P6SM FEW050', 'VFR'],
  ['TAF KTOL 131140Z 1312/1412 VRB03KT 1SM BR BKN002', 'LIFR'],
  // Wind groups and time groups must never be read as visibility or ceiling
  ['FM131800 23012G20KT P6SM SKC', 'VFR'],
  ['FM131300 30007KT P6SM SCT090', 'VFR'],
  // No visibility/ceiling → defaults to VFR (unknown is treated as unlimited)
  ['FM131800 24010KT', 'VFR'],
];

for (const [line, expected] of cases) {
  test(`tafLineCat: "${line}" → ${expected}`, () => {
    assert.equal(tafLineCat(line), expected);
  });
}

test('colorTaf splits periods at FM/TEMPO/BECMG/PROB and colors each', () => {
  const raw = 'TAF KTOL 131720Z 1318/1418 24010KT P6SM FEW050 FM140000 3SM -RA BKN012 TEMPO 1402/1404 1/2SM FG OVC002';
  const out = colorTaf(raw);
  const spans = [...out.matchAll(/<span style="color:(var\(--\w+\))[^"]*">([^<]*)<\/span>/g)].map(m => [m[1], m[2]]);
  assert.equal(spans.length, 3, 'three periods');
  assert.equal(spans[0][0], 'var(--vfr)');
  assert.equal(spans[1][0], 'var(--mvfr)');
  assert.equal(spans[2][0], 'var(--lifr)');
  assert.ok(spans[2][1].startsWith('TEMPO 1402/1404'));
});

test('colorTaf escapes HTML in TAF text', () => {
  const out = colorTaf('TAF KXXX 131720Z <script>alert(1)</script> P6SM');
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
});
