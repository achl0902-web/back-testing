// Shared data loading for QLD research. Everything here is fixed so every step is scored the same way.
const fs = require('fs');
const path = require('path');
const E = require('../../src/engine.js');
const B = require('./buyrules.js');

const R = path.join(__dirname, '..');
const DATA = path.join(R, 'data');
const MACRO = path.join(R, '..', 'data', 'macro');

const day = s => Math.round(Date.parse(s) / 86400000);
const iso = n => new Date(n * 86400000).toISOString().slice(0, 10);

let _cache = null;
function load() {
  if (_cache) return _cache;
  // NDX: QLD synthetic (2x QQQ total return - financing - 0.95% fee); SPX: 2x S&P total return proxy (fee 0.89%)
  const read = f => withY10(JSON.parse(fs.readFileSync(path.join(DATA, f))));
  const ND = E.prepData(read('ndx_ms.json'));
  const SP = E.prepData(read('spx_ms.json'), 2, 0.0089);
  ND.name = 'NDX'; SP.name = 'SPX2';
  _cache = { ND, SP };
  return _cache;
}

// 10-year Treasury yield (DGS10) on each trading day, forward-filled, null before 1962; prepData turns it into D.bx
function withY10(raw) {
  const m = new Map();
  for (const ln of fs.readFileSync(path.join(MACRO, 'DGS10.csv'), 'utf8').trim().split('\n').slice(1)) { const [d, v] = ln.split(','); if (v && v !== '.') m.set(day(d), +v / 100); }
  let d = raw.d0, last = null; raw.y10 = [];
  for (let i = 0; i < raw.px.length; i++) { if (i) d += raw.dd[i - 1]; if (m.has(d)) last = m.get(d); raw.y10.push(last); }
  return raw;
}

// synthetic high/low of the leveraged series from the index's daily range (for stochastics etc.)
function highLow(D) {
  const file = path.join(MACRO, D.name === 'NDX' ? 'OHLC_NDX.csv' : 'OHLC_SPX.csv');
  const H = new Float64Array(D.n), L = new Float64Array(D.n);
  if (!fs.existsSync(file)) { for (let i = 0; i < D.n; i++) H[i] = L[i] = D.lx[i]; return [H, L]; }
  const m = new Map();
  for (const ln of fs.readFileSync(file, 'utf8').trim().split('\n').slice(1)) { const [d, h, l, c] = ln.split(','); m.set(day(d), [+h, +l, +c]); }
  for (let i = 0; i < D.n; i++) {
    const r = m.get(D.day[i]), q = i ? m.get(D.day[i - 1]) : null;
    if (r && q && r[0] > r[1]) {
      H[i] = Math.max(D.lx[i], D.lx[i - 1] * (1 + 2 * (r[0] / q[2] - 1)));
      L[i] = Math.min(D.lx[i], D.lx[i - 1] * (1 + 2 * (r[1] / q[2] - 1)));
    } else H[i] = L[i] = D.lx[i];
  }
  return [H, L];
}

// ---------- fixed validation sets (do not change between steps; see PROTOCOL.md) ----------
function windows(D, y0, y1, len, startMonth = 1) {
  const w = [];
  for (let y = y0; y <= y1; y++) {
    const a = E.idxOfDay(D, day(`${y}-${String(startMonth).padStart(2, '0')}-02`), true);
    const endY = startMonth === 1 ? y + len - 1 : y + len;
    const endM = startMonth === 1 ? 12 : startMonth - 1;
    const lastDay = new Date(Date.UTC(endY, endM, 0)).getUTCDate();
    const b = E.idxOfDay(D, day(`${endY}-${String(endM).padStart(2, '0')}-${lastDay}`), false);
    if (b > a && b < D.n) w.push([a, b]);
  }
  return w;
}
function sets(startMonth = 1) {
  const { ND, SP } = load();
  return [
    { key: 'N10', label: '나스닥100 10년 (1999~2016 시작)', D: ND, w: windows(ND, 1999, 2016, 10, startMonth), oos: false },
    { key: 'N10oos', label: '나스닥100 10년 (1986~1998 시작, 표본 밖)', D: ND, w: windows(ND, 1986, 1998, 10, startMonth), oos: true },
    { key: 'S10', label: 'S&P 2배 10년 (표본 밖)', D: SP, w: windows(SP, 1986, 2016, 10, startMonth), oos: true },
    { key: 'N5', label: '나스닥100 5년', D: ND, w: windows(ND, 1986, 2021, 5, startMonth), oos: false },
    { key: 'S5', label: 'S&P 2배 5년 (표본 밖)', D: SP, w: windows(SP, 1986, 2021, 5, startMonth), oos: true },
  ];
}
const EPISODES = [['2025', '2024-01-02', '2025-12-31'], ['2022', '2021-01-04', '2023-12-29'], ['2020', '2019-01-02', '2021-06-30'],
  ['2018', '2017-01-03', '2019-12-31'], ['2008', '2006-01-03', '2010-12-31'], ['2000', '1998-01-02', '2003-12-31']];
function episodes() {
  const { ND } = load();
  return EPISODES.map(([n, a, b]) => ({ key: n, D: ND, i0: E.idxOfDay(ND, day(a), true), i1: E.idxOfDay(ND, day(b), false) }));
}

module.exports = { E, B, load, withY10, highLow, sets, episodes, day, iso, EPISODES };
