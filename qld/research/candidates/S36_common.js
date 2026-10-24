// S36 공통 도우미(신호 모듈 아님). 네 방향 모두 1960~85 hist D에서도 계산되는 자료만 쓴다.
//  - trendState: 12개월(252일)·2개월(42일) 지수 수익률 부호로 강세·조정·약세·반등 4분할 (Goulding·Harvey·Mazzoleni 2023). 반등 = 12개월 < 0, 2개월 > 0
//  - cpiZ: CPI 전년비(CPIAUCSL, 시차 50일)의 756일 z (1947~)
//  - termSpread: 10년 − 3개월 국채(GS10 − TB3MS, 둘 다 월평균, 시차 35일). 두 시대에 같은 정의(1953~)
//  - dffTight: 연방기금 실효금리(DFF 일간, 시차 1일) 21일 평균의 63거래일 변화(%p) (1954-07~)
//  - infZ: 챔피언 v2 인플레 복귀 금지의 세 z(달러·PPI·유가). 1986~ D는 lib/v2.js와 같은 catalog 키, 1960~85 hist D는 v2.inflBlockHist와 같은 월간 대체
//  - sbCorr: S35 공통의 주식-채권 63일 상관(DGS10 1962~, 시차 1일) 재사용
const fs = require('fs'), path = require('path');
const M = require('../lib/macro.js'), K = require('../lib/catalog.js'), S35 = require('./S35_common.js');
const memo = new Map();
const key = (D, k) => k + '|' + D.n + '|' + D.day[0] + '|' + D.day[D.n - 1];
const keep = (D, k, f) => { const q = key(D, k); if (!memo.has(q)) memo.set(q, f()); return memo.get(q); };
const fin = a => Float64Array.from(a, v => (v === undefined || !isFinite(v)) ? NaN : v);
const isHist = D => D.day[0] < Date.UTC(1980, 0, 1) / 864e5;

exports.trendState = D => keep(D, 'trend', () => {
  const o = new Int8Array(D.n); // 0 강세, 1 조정, 2 약세, 3 반등, -1 자료 부족
  for (let j = 0; j < D.n; j++) {
    if (j < 252 || !(D.px[j - 252] > 0) || !(D.px[j - 42] > 0)) { o[j] = -1; continue; }
    const slow = D.px[j] / D.px[j - 252] - 1, fast = D.px[j] / D.px[j - 42] - 1;
    o[j] = slow >= 0 ? (fast >= 0 ? 0 : 1) : (fast >= 0 ? 3 : 2);
  }
  return o;
});

exports.cpiZ = D => keep(D, 'cpiz', () => K.zscore(fin(K.helpers.ret(Array.from(M.series(D, 'CPIAUCSL', 50)), 252))));

exports.termSpread = D => keep(D, 'term', () => {
  const g = M.series(D, 'GS10', 35), t = M.series(D, 'TB3MS', 35), o = new Float64Array(D.n).fill(NaN);
  for (let j = 0; j < D.n; j++) if (!isNaN(g[j]) && !isNaN(t[j])) o[j] = g[j] - t[j];
  return o;
});

exports.dffTight = D => keep(D, 'dff', () => {
  const f = M.series(D, 'DFF', 1), m = new Float64Array(D.n).fill(NaN), o = new Float64Array(D.n).fill(NaN);
  for (let j = 20; j < D.n; j++) { let s = 0, c = 0; for (let k = j - 20; k <= j; k++) if (!isNaN(f[k])) { s += f[k]; c++; } if (c >= 15) m[j] = s / c; }
  for (let j = 63; j < D.n; j++) if (!isNaN(m[j]) && !isNaN(m[j - 63])) o[j] = m[j] - m[j - 63];
  return o;
});

function monthly(D, file, lag) { // lib/v2.js monthly()와 같은 정렬
  const day = s => Math.round(Date.parse(s) / 864e5);
  const obs = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1).map(r => r.split(',')).filter(([d, v]) => d && isFinite(parseFloat(v)))
    .map(([d, v]) => [day(d.slice(0, 10)) + lag, parseFloat(v)]).sort((a, b) => a[0] - b[0]);
  const a = new Float64Array(D.n).fill(NaN), last = obs.length ? obs[obs.length - 1][0] : -1e9; let k = -1;
  for (let i = 0; i < D.n; i++) { while (k + 1 < obs.length && obs[k + 1][0] <= D.day[i]) k++; if (k >= 0 && D.day[i] <= last + 90) a[i] = obs[k][1]; }
  return a;
}
exports.infZ = D => keep(D, 'infz', () => {
  if (!isHist(D)) return ['x_dxy', 'i_ppi', 'x_oil'].map(k => K.zOf(D, k).z);
  const R = path.join(__dirname, '..'), ret = K.helpers.ret;
  const ppi = ret(monthly(D, path.join(R, '..', 'data', 'macro', 'PPIACO.csv'), 50), 252);
  const oil = ret(monthly(D, path.join(R, 'data', 'hist', 'WTISPLC.csv'), 35), 126);
  const usd = ret(monthly(D, path.join(R, 'data', 'hist', 'TWEXMMTH.csv'), 35), 126);
  return [usd, ppi, oil].map(a => K.zscore(fin(a)));
});

exports.sbCorr = D => S35.sbCorr(D);
