// Loads index.html's inline script into a Node VM with a permissive fake DOM so the
// pure functions (TAF parsing, runway math, geometry, formatting) can be unit-tested
// without a browser. Run via `npm test` or `node --test tests/*.test.js`.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'site');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`expected exactly 1 inline <script>, found ${scripts.length}`);
const src = scripts[0];

// ---- fake DOM -------------------------------------------------------------------
function makeEl(tag = 'div') {
  const e = {
    tagName: tag.toUpperCase(), style: {}, dataset: {}, children: [], attributes: {},
    innerHTML: '', textContent: '', src: '', id: '', className: '', open: false, hidden: false,
    offsetWidth: 800, offsetHeight: 60, clientWidth: 800, clientHeight: 60, scrollTop: 0, scrollHeight: 0, naturalWidth: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    appendChild(c) { this.children.push(c); return c; }, insertBefore(c) { this.children.unshift(c); return c; },
    removeChild(c) { return c; }, remove() {}, replaceChildren() {},
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getAttribute() { return null; }, setAttribute(k, v) { this.attributes[k] = v; }, removeAttribute() {},
    getBoundingClientRect() { return { x: 0, y: 0, width: 800, height: 60, top: 0, left: 0, right: 800, bottom: 60 }; },
    getContext() { return ctx2d; }, closest() { return null; }, contains() { return false; },
    click() {}, focus() {}, blur() {}, scrollIntoView() {},
  };
  return e;
}
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'canvas' ? makeEl('canvas') : () => {}) , set: () => true });

const document = {
  hidden: false, title: '', readyState: 'complete', fullscreenElement: null,
  documentElement: makeEl('html'), body: makeEl('body'), head: makeEl('head'),
  getElementById() { return makeEl(); }, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
  createElement(t) { return makeEl(t); }, createTextNode(t) { return { textContent: t }; },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
};

const storage = new Map();
const localStorage = {
  getItem: k => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k),
  clear: () => storage.clear(),
};

const sandbox = {
  console, Intl, Date, Math, JSON, Promise, AbortController, URL, URLSearchParams, Map, Set, Proxy, Reflect, Symbol,
  document, localStorage, sessionStorage: localStorage,
  navigator: { userAgent: 'node-test', language: 'en-US', onLine: true },
  location: { hostname: 'localhost', href: 'http://localhost/', protocol: 'http:', reload() {} },
  screen: { width: 1920, height: 1080 },
  innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  // network and timers are inert: nothing fires, nothing resolves
  fetch: () => new Promise(() => {}),
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  ResizeObserver: class { observe() {} disconnect() {} unobserve() {} },
  IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  getComputedStyle: () => ({ overflowY: 'visible', fontSize: '16px' }),
  performance: { now: () => Date.now() },
  alert() {}, scrollTo() {}, scrollY: 0,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

// Expose script-scoped const/let bindings that tests need (function declarations are
// already globals in a VM script context; these are not).
const exportLine = `
;globalThis.__x = {
  RUNWAYS, ALERT_TYPES, AIRPORTS, IDS, AWC_PROXY_MAP, SKY_LABELS, BG_LAT, BG_LON, SK,
  FD_STATIONS, FD_ALTS, _fmt12, _fmt24,
  getWeatherData: () => weatherData,
  setWeatherData: d => { weatherData = d; },
  setAtisTried: (icao, t) => { if (t) _atisTried[icao] = t; else delete _atisTried[icao]; },
  setAtis: (icao, data, err) => { if (data) atisData[icao] = { data, t: Date.now() }; else delete atisData[icao]; if (err) atisErr[icao] = err; else delete atisErr[icao]; },
};`;

const context = vm.createContext(sandbox);
let loadError = null;
try {
  vm.runInContext(src + exportLine, context, { filename: 'index.html#script' });
} catch (e) {
  loadError = e;
}

module.exports = { ctx: context, x: context.__x || {}, html, src, loadError, makeEl, ROOT };
