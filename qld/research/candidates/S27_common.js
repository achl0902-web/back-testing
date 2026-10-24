// S27 공통 도우미(신호 모듈 아님). 연구용 요소(S25 B 금리 인상 국면, S21 C 충격 이탈 기억, S13 B veto=2)는 원 모듈 계산 그대로,
// 1960~85 재확인용 _hist 자료는 T14_A.js와 같은 대체 자료·같은 읽기 방식(발표 시차 뒤 앞값 채움, 마지막 관측 90일 뒤 NaN).
const fs = require('fs'), path = require('path'), E = require('../../src/engine.js'), M = require('../lib/macro.js'), P0 = E.DEFAULTS;
const R = path.join(__dirname, '..'), day = s => Math.round(Date.parse(s) / 864e5);
exports.hikeFrom = (y, n, th) => { // S25 B: 2년물이 252거래일 전보다 th%p 이상 높으면 인상 국면
  const h = new Uint8Array(n);
  for (let j = 252; j < n; j++) if (!isNaN(y[j]) && !isNaN(y[j - 252]) && y[j] - y[j - 252] >= th) h[j] = 1;
  return h;
};
exports.hike = (D, th) => exports.hikeFrom(M.series(D, 'DGS2', 1), D.n, th);
exports.shock = (D, th) => s => s >= 0 && D.rsiw[s] >= th && !(D.ms[s] >= P0.macroTh); // S21 C: 이탈일 주봉 RSI ≥ th · 매크로 50% 미만
exports.shockOk = (D, j) => D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j]; // S21 C 충격 복귀 경로(켜진 축 수 조건만 뺀 챔피언 복귀)
exports.downOnlyCount = (D, j) => { // S13 B veto=2: 축①을 하방 변동성(down20 > 30%)으로만 센 축 수
  const a = E.axesAt(D, P0, j);
  return (D.vols.down20[j] > P0.dnHi ? 1 : 0) + (a[1] ? 1 : 0) + (a[2] ? 1 : 0) + (a[3] ? 1 : 0);
};
// ---- _hist 전용(1960~85 S&P 2배 재확인, lib/histcheck.js에서만 사용) ----
function series(D, file, lag) { // T14_A.js와 동일
  const obs = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1).map(r => r.split(',')).filter(([d, v]) => d && isFinite(parseFloat(v)))
    .map(([d, v]) => [day(d.slice(0, 10)) + lag, parseFloat(v)]).sort((a, b) => a[0] - b[0]);
  const a = new Float64Array(D.n).fill(NaN), last = obs.length ? obs[obs.length - 1][0] : -1e9; let k = -1;
  for (let i = 0; i < D.n; i++) { while (k + 1 < obs.length && obs[k + 1][0] <= D.day[i]) k++; if (k >= 0 && D.day[i] <= last + 90) a[i] = obs[k][1]; }
  return a;
}
exports.series = series;
exports.inflBlockHist = (D, K, z, need) => { // T14_A.js와 동일: PPIACO 시차 50일, 유가 WTISPLC·달러 TWEXMMTH 월간 시차 35일(1973 이전 달러 NaN = 과열 아님)
  const ret = K.helpers.ret;
  const ppi = ret(series(D, path.join(R, '..', 'data', 'macro', 'PPIACO.csv'), 50), 252);
  const oil = ret(series(D, path.join(R, 'data', 'hist', 'WTISPLC.csv'), 35), 126);
  const usd = ret(series(D, path.join(R, 'data', 'hist', 'TWEXMMTH.csv'), 35), 126);
  const zs = [usd, ppi, oil].map(a => K.zscore(Float64Array.from(a, v => isFinite(v) ? v : NaN)));
  const b = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) { let c = 0; for (const s of zs) if (s[j] > z) c++; b[j] = c >= need ? 1 : 0; }
  return b;
};
// 2년물: data/macro/DGS2.csv(FRED, 1976-06~)를 시차 1일로 그대로 읽음 → 1977-06 이전은 252일 전 값이 없어 인상 국면 꺼짐(NaN).
exports.hikeHist = (D, th) => exports.hikeFrom(series(D, path.join(R, '..', 'data', 'macro', 'DGS2.csv'), 1), D.n, th);
