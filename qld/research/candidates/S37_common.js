// S37 공통 도우미(신호 모듈 아님). 세 방향 모두 1960~85 hist D에서도 계산되는 자료만 쓴다(가격, DGS10 1962~, UNRATE 1948~).
//  - young(D, K): 지수의 252거래일 최고점이 최근 K거래일 안에 있음(하락이 '젊음': 강세장 직후의 조정·충격) — j일 종가까지
//  - rateVolZ(D): 미국채 10년 금리(DGS10, 시차 1일) 일간 변화(%p)의 20일 표준편차, 756일 z (MOVE 무료 대체, SCOUT 3회차 표 25)
//  - laborHealthy(D): 실업률(UNRATE, 시차 40일)이 자기 12개월 이동평균 이하(Growth-Trend Timing의 '경기 양호' 판정)
//  - x4Axes(D): ELEMENTS 풀 X4(축④는 10일 변동성 ≥ 0.25일 때만), candidates/POOL.js와 같은 정의
const E = require('../../src/engine.js'), M = require('../lib/macro.js'), K = require('../lib/catalog.js');
const P0 = E.DEFAULTS, memo = new Map();
const keep = (D, k, f) => { const q = k + '|' + D.n + '|' + D.day[0] + '|' + D.day[D.n - 1]; if (!memo.has(q)) memo.set(q, f()); return memo.get(q); };

exports.young = (D, Kd) => keep(D, 'young' + Kd, () => {
  const hi = K.helpers.rollMax(Array.from(D.px), 252), o = new Uint8Array(D.n);
  for (let j = 251; j < D.n; j++) { let m = -Infinity; for (let k = Math.max(0, j - Kd + 1); k <= j; k++) if (D.px[k] > m) m = D.px[k]; o[j] = m >= hi[j] - 1e-9 ? 1 : 0; }
  return o;
});

exports.rateVolZ = D => keep(D, 'ratevol', () => {
  const y = M.series(D, 'DGS10', 1), d = new Float64Array(D.n).fill(NaN);
  for (let j = 1; j < D.n; j++) if (!isNaN(y[j]) && !isNaN(y[j - 1])) d[j] = y[j] - y[j - 1];
  return K.zscore(K.helpers.rollStd(Array.from(d), 20));
});

exports.laborHealthy = D => keep(D, 'labor', () => {
  const obs = M.read('UNRATE'), lag = 40, f = [];
  for (let i = 11; i < obs.length; i++) { let s = 0; for (let k = i - 11; k <= i; k++) s += obs[k][1]; f.push([obs[i][0] + lag, obs[i][1] <= s / 12 + 1e-9 ? 1 : 0]); }
  const o = new Uint8Array(D.n), last = f.length ? f[f.length - 1][0] : -1e9; let k = -1;
  for (let j = 0; j < D.n; j++) { while (k + 1 < f.length && f[k + 1][0] <= D.day[j]) k++; o[j] = (k >= 0 && D.day[j] <= last + 90) ? f[k][1] : 0; }
  return o;
});

exports.x4Axes = D => j => { const a = E.axesAt(D, P0, j); return (a[0] ? 1 : 0) + (a[1] ? 1 : 0) + (a[2] ? 1 : 0) + (a[3] && D.vols.rv10[j] >= 0.25 ? 1 : 0); };
