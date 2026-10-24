// S28 공통 도우미(신호 모듈 아님). 사용자 지정 지표: 신용융자(Z.1), 미국채 10년(DGS10), Put/Call(CBOE), 이평선.
// 모든 값은 j일 종가까지 공개된 것만: Z.1은 날짜(분기 첫날) + 165일(분기 끝 + 발표 약 75일), DGS10·Put/Call은 시차 1일.
// 1960~85 재확인: MARGIN_Z1(1945~)·DGS10(1962~)·지수 이평선은 hist D에서도 날짜로 맞춰져 그대로 돈다. Put/Call은 1995-09 이전 없음(NaN = 꺼짐).
const M = require('../lib/macro.js');
const day = s => Math.round(Date.parse(s) / 864e5);
const nan = n => new Float64Array(n).fill(NaN);
// 신용융자 전년비(분기값 앞값 채움, 252거래일 전 대비)
exports.marginYoY = D => { const a = M.series(D, 'MARGIN_Z1', 165), o = nan(D.n);
  for (let j = 252; j < D.n; j++) if (a[j] > 0 && a[j - 252] > 0) o[j] = a[j] / a[j - 252] - 1; return o; };
// 10년 금리 k거래일 변화(%p)
exports.tnxChg = (D, k) => { const a = M.series(D, 'DGS10', 1), o = nan(D.n);
  for (let j = k; j < D.n; j++) if (isFinite(a[j]) && isFinite(a[j - k])) o[j] = a[j] - a[j - k]; return o; };
// 지수 N일 단순 이평(D.ma에 있으면 그대로)
exports.ma = (D, N) => { if (D.ma[N]) return D.ma[N]; const o = nan(D.n); let s = 0;
  for (let j = 0; j < D.n; j++) { s += D.px[j]; if (j >= N) s -= D.px[j - N]; if (j >= N - 1) o[j] = s / N; } return o; };
// Put/Call 총 비율: 아카이브(1995-09~2003-12) + TOTALPC(2006-11~2019-10). 관측일 + 1일에 공개, 마지막 관측이 5일보다 오래되면 NaN(공백 기간 앞값 채움 없음)
const cache = new Map();
exports.pc = D => { const key = D.n + '|' + D.day[0] + '|' + D.day[D.n - 1]; if (cache.has(key)) return cache.get(key);
  const obs = [...M.read('CBOE_PCARCHIVE').filter(([d]) => d <= day('2003-12-31')), ...M.read('CBOE_TOTALPC').filter(([d]) => d >= day('2006-11-01'))]
    .map(([d, v]) => [d + 1, v]).sort((a, b) => a[0] - b[0]);
  const o = nan(D.n); let k = -1;
  for (let j = 0; j < D.n; j++) { while (k + 1 < obs.length && obs[k + 1][0] <= D.day[j]) k++; if (k >= 0 && D.day[j] - obs[k][0] <= 5) o[j] = obs[k][1]; }
  cache.set(key, o); return o; };
// Put/Call k거래일 평균(k일 모두 값이 있을 때만)
exports.pcAvg = (D, k) => { const a = exports.pc(D), o = nan(D.n);
  for (let j = k - 1; j < D.n; j++) { let s = 0, ok = true; for (let i = j - k + 1; i <= j; i++) { if (!isFinite(a[i])) { ok = false; break; } s += a[i]; } if (ok) o[j] = s / k; } return o; };
exports.pc10 = D => exports.pcAvg(D, 10);
