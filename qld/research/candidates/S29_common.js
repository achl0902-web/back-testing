// S29 공통 도우미(신호 모듈 아님). 공포·탐욕(CNN, 2011-01~)과 Put/Call(CBOE 총 비율, 1995-09~2003 · 2006-11~2026 이어 붙임).
// 모든 값은 j일 종가까지 공개된 것만: 관측일 + 1일에 공개(시차 1일). 자료 없는 날은 NaN → 그 요소는 꺼짐.
const M = require('../lib/macro.js'), K = require('../lib/catalog.js');
const day = s => Math.round(Date.parse(s) / 864e5);
const nan = n => new Float64Array(n).fill(NaN);
// 공포·탐욕 0~100(낮을수록 공포). macro.series: 시차 1일 뒤 앞값 채움, 마지막 관측 90일 뒤 NaN, 2011-01-04 이전 NaN
exports.fg = D => M.series(D, 'FG_CNN', 1);
// k거래일 이동 최솟값·최댓값(창 안에 값이 하나라도 있으면 그 값들로, 모두 NaN이면 NaN)
const roll = (a, k, f) => { const o = nan(a.length);
  for (let j = 0; j < a.length; j++) { let m = NaN; for (let i = Math.max(0, j - k + 1); i <= j; i++) if (isFinite(a[i])) m = isFinite(m) ? f(m, a[i]) : a[i]; o[j] = m; } return o; };
exports.rollMin = (a, k) => roll(a, k, Math.min);
exports.rollMax = (a, k) => roll(a, k, Math.max);
// Put/Call 총 비율: 아카이브(1995-09~2003-12) + TOTALPC(2006-11~2019-10-04) + TOTALPC_D(그 뒤 날짜만 이어 붙임, 기존 값 덮지 않음).
// 관측일 + 1일에 공개, 마지막 관측이 5일보다 오래되면 NaN(2004~2006-10 공백은 앞값 채움 없음). S28_common.pc에 일간 파일만 더한 것.
const cache = new Map();
exports.pc = D => { const key = D.n + '|' + D.day[0] + '|' + D.day[D.n - 1]; if (cache.has(key)) return cache.get(key);
  const tot = M.read('CBOE_TOTALPC').filter(([d]) => d >= day('2006-11-01')), last = tot.length ? tot[tot.length - 1][0] : -1e9;
  const obs = [...M.read('CBOE_PCARCHIVE').filter(([d]) => d <= day('2003-12-31')), ...tot, ...M.read('CBOE_TOTALPC_D').filter(([d]) => d > last)]
    .map(([d, v]) => [d + 1, v]).sort((a, b) => a[0] - b[0]);
  const o = nan(D.n); let k = -1;
  for (let j = 0; j < D.n; j++) { while (k + 1 < obs.length && obs[k + 1][0] <= D.day[j]) k++; if (k >= 0 && D.day[j] - obs[k][0] <= 5) o[j] = obs[k][1]; }
  cache.set(key, o); return o; };
// Put/Call k거래일 평균(k일 모두 값이 있을 때만)
exports.pcAvg = (D, k) => { const a = exports.pc(D), o = nan(D.n);
  for (let j = k - 1; j < D.n; j++) { let s = 0, ok = true; for (let i = j - k + 1; i <= j; i++) { if (!isFinite(a[i])) { ok = false; break; } s += a[i]; } if (ok) o[j] = s / k; } return o; };
exports.pc10 = D => exports.pcAvg(D, 10);
// Put/Call k일 평균의 756일 z(높을수록 헤지 수요 큼 = 공포). NaN이면 비교가 모두 거짓 → 요소 꺼짐
exports.pcZ = (D, k) => K.zscore(exports.pcAvg(D, k));
