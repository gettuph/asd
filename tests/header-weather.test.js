'use strict';
// The header animation must react to the METAR *body* only. Remarks (TSNO, LTG DSNT, etc.)
// drive lightning but never precipitation; "TS" in the body means thunderstorm at the station.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ctx } = require('./harness');

function detect(rawOb) {
  const calls = { precip: null, stopPrecip: false, ltg: null, stopLtg: false };
  ctx.startPrecip = (type, n) => { calls.precip = { type, n }; };
  ctx.stopPrecip = () => { calls.stopPrecip = true; };
  ctx.startLightning = cfg => { calls.ltg = cfg; };
  ctx.stopLightning = () => { calls.stopLtg = true; };
  ctx.applyHeaderTheme({ rawOb, icaoId: 'KTOL' });
  return calls;
}

test('rain in body → rain; light vs heavy sets particle count', () => {
  assert.equal(detect('METAR KTOL 051652Z 22011KT 3SM -RA BR OVC008 14/12 A2980 RMK AO2').precip.type, 'rain');
  assert.ok(detect('METAR KTOL 051652Z 22011KT 3SM -RA OVC008 14/12 A2980 RMK AO2').precip.n <
            detect('METAR KTOL 051652Z 22011KT 1SM +RA OVC008 14/12 A2980 RMK AO2').precip.n);
});
test('snow in body → snow', () => {
  assert.equal(detect('METAR KTOL 051652Z 36011KT 1/2SM SN OVC005 M02/M04 A2990 RMK AO2').precip.type, 'snow');
});
test('no weather → precipitation stopped', () => {
  const c = detect('METAR KTOL 101752Z 25004KT 10SM CLR 17/06 A3000 RMK AO2 SLP161');
  assert.equal(c.precip, null); assert.equal(c.stopPrecip, true);
});
test('remarks never trigger precipitation (TSNO, SNINCR-style tokens, RA in RMK)', () => {
  assert.equal(detect('METAR KTOL 051652Z 22011KT 10SM CLR 14/06 A2980 RMK AO2 TSNO').precip, null);
  assert.equal(detect('METAR KTOL 051652Z 22011KT 10SM CLR 14/06 A2980 RMK AO2 RAB05E20').precip, null);
  assert.equal(detect('METAR KTOL 051652Z 22011KT 10SM CLR 14/06 A2980 RMK AO2 SNINCR 1/3').precip, null);
});

test('TS in body → station lightning (largest, most frequent)', () => {
  const c = detect('SPECI KTOL 110403Z 24013KT 10SM TS FEW055 SCT110 24/21 A2997 RMK AO2 LTG DSNT ALQDS');
  assert.ok(c.ltg, 'lightning started');
  assert.ok(c.ltg.size >= 0.9);
});
test('LTG DSNT in remarks → small infrequent lightning', () => {
  const c = detect('METAR KTOL 110353Z 24013KT 10SM FEW055 24/21 A2997 RMK AO2 LTG DSNT W');
  assert.ok(c.ltg, 'lightning started');
  assert.ok(c.ltg.size < 0.5);
  assert.ok(c.ltg.interval >= 2000);
});
test('LTG VC / FRQ scale between DSNT and TS', () => {
  const vc = detect('METAR KTOL 110353Z 24013KT 10SM FEW055 24/21 A2997 RMK AO2 LTG VC NE').ltg;
  const frq = detect('METAR KTOL 110353Z 24013KT 10SM FEW055 24/21 A2997 RMK AO2 FRQ LTGICCG VC').ltg;
  const dsnt = detect('METAR KTOL 110353Z 24013KT 10SM FEW055 24/21 A2997 RMK AO2 LTG DSNT W').ltg;
  assert.ok(dsnt.size < vc.size && vc.size < frq.size);
});
test('TSNO in remarks is not lightning; no LTG → lightning stopped', () => {
  const c = detect('METAR KTOL 051652Z 22011KT 10SM CLR 14/06 A2980 RMK AO2 TSNO');
  assert.equal(c.ltg, null); assert.equal(c.stopLtg, true);
});
test('no METAR at all does not throw', () => {
  assert.doesNotThrow(() => ctx.applyHeaderTheme(null));
});
