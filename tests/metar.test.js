'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ctx } = require('./harness');
const { getCeil, skyDesc, getCat, fmtAlt, fmtDA, fmtWind, fmtTemp, esc } = ctx;

// ---- ceilings and sky ------------------------------------------------------------
test('getCeil: BKN/OVC/VV/OVX are ceilings, FEW/SCT are not', () => {
  assert.equal(getCeil([{ cover: 'FEW', base: 1500 }, { cover: 'SCT', base: 2500 }]), null);
  assert.equal(getCeil([{ cover: 'SCT', base: 2500 }, { cover: 'BKN', base: 3800 }]), 3800);
  assert.equal(getCeil([{ cover: 'OVC', base: 900 }]), 900);
  assert.equal(getCeil([{ cover: 'VV', base: 200 }]), 200);
  assert.equal(getCeil([{ cover: 'OVX', base: 200 }]), 200, 'AWC JSON uses OVX for indefinite ceiling');
  assert.equal(getCeil([]), null);
  assert.equal(getCeil(null), null);
});

test('skyDesc: wording for clear, layers, ceilings, indefinite', () => {
  assert.equal(skyDesc([]), 'Clear');
  assert.equal(skyDesc([{ cover: 'CLR' }]), 'Clear below 12,000 ft');
  assert.equal(skyDesc([{ cover: 'FEW', base: 5500 }]), 'Few at 5500 ft');
  assert.equal(skyDesc([{ cover: 'SCT', base: 2500 }, { cover: 'BKN', base: 3800 }]), 'Scattered at 2500 ft');
  assert.equal(skyDesc([{ cover: 'BKN', base: 800 }]), 'Broken ceiling at 800 ft');
  assert.equal(skyDesc([{ cover: 'OVX', base: 200 }]), 'Indefinite ceiling at 200 ft');
});

// ---- flight category -------------------------------------------------------------
test('getCat thresholds', () => {
  assert.equal(getCat(10, 5000), 'VFR');
  assert.equal(getCat(6, 3100), 'VFR');
  assert.equal(getCat(5, 5000), 'MVFR');
  assert.equal(getCat(10, 3000), 'MVFR');
  assert.equal(getCat(3, 5000), 'MVFR');
  assert.equal(getCat(2.5, 5000), 'IFR');
  assert.equal(getCat(10, 900), 'IFR');
  assert.equal(getCat(10, 500), 'IFR');
  assert.equal(getCat(0.75, 5000), 'LIFR');
  assert.equal(getCat(10, 400), 'LIFR');
  assert.equal(getCat(null, null), 'VFR', 'missing data is treated as unlimited');
});

test('getCat tolerates the "10+" visibility string AWC returns', () => {
  assert.equal(getCat('10+', 5000), 'VFR');
});

// ---- altimeter -------------------------------------------------------------------
test('fmtAlt converts hPa to inches of mercury and passes inHg through', () => {
  assert.equal(fmtAlt(1013.25), '29.92" Hg');
  assert.equal(fmtAlt(1009.2), '29.80" Hg');
  assert.equal(fmtAlt(29.97), '29.97" Hg');
  assert.equal(fmtAlt(null), '—');
  assert.equal(fmtAlt(0), '—');
});

// ---- density altitude ------------------------------------------------------------
test('fmtDA: standard day at sea level is ~0 ft', () => {
  assert.ok(Math.abs(fmtDA(15, 1013.25, 0)) <= 5, String(fmtDA(15, 1013.25, 0)));
});
test('fmtDA: KTOL (206 m) hot day', () => {
  // PA = (29.92-29.92)*1000 + 676 = 676; ISA = 15 - 1.35 = 13.65; DA = 676 + 120*(30-13.65) = 2638
  const da = fmtDA(30, 1013.25, 206);
  assert.ok(Math.abs(da - 2638) <= 5, `got ${da}`);
});
test('fmtDA: low pressure raises DA', () => {
  assert.ok(fmtDA(15, 1000, 206) > fmtDA(15, 1013.25, 206));
});
test('fmtDA: missing inputs → null', () => {
  assert.equal(fmtDA(null, 1013, 206), null);
  assert.equal(fmtDA(15, null, 206), null);
  assert.equal(fmtDA(15, 1013, null), null);
});

// ---- wind / temperature text -----------------------------------------------------
test('fmtWind', () => {
  assert.equal(fmtWind({ wdir: 220, wspd: 11 }), '220° at 11 kt');
  assert.equal(fmtWind({ wdir: 40, wspd: 7 }), '040° at 7 kt');
  assert.equal(fmtWind({ wdir: 220, wspd: 11, wgst: 21 }), '220° at 11 kt, gusting 21 kt');
  assert.equal(fmtWind({ wdir: 'VRB', wspd: 3 }), 'Variable at 3 kt');
  assert.equal(fmtWind({ wdir: 0, wspd: 0 }), 'Calm');
  assert.equal(fmtWind(null), 'Calm');
});
test('fmtTemp shows C and F; negatives come through signed', () => {
  assert.equal(fmtTemp(14.4), '14.4°C (58°F)');
  assert.equal(fmtTemp(-5), '-5°C (23°F)');
  assert.equal(fmtTemp(null), '—');
});

// ---- escaping --------------------------------------------------------------------
test('esc escapes &, <, >, "', () => {
  assert.equal(esc('<b a="1">&</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&lt;/b&gt;');
  assert.equal(esc(null), '');
});
