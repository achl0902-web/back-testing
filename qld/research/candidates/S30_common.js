// S30 공통 도우미(신호 모듈 아님). 정찰(SCOUT.md) 뒤 새 출처: 신용융자 월간(FINRA), AAII 설문, VRP(VIX² − S&P 실현분산), Cboe SKEW.
// 모든 값은 j일 종가까지 공개된 것만(macro.series: 관측일 + 시차일에 공개, 앞값 채움, 마지막 관측 90일 뒤 NaN). 자료 없는 날은 NaN → 요소 꺼짐.
const M = require('../lib/macro.js');
const nan = n => new Float64Array(n).fill(NaN);
const cache = new Map();
const memo = (D, name, f) => { const k = name + '|' + D.n + '|' + D.day[0] + '|' + D.day[D.n - 1]; if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
// k거래일 창 최댓값(창 안 값 있는 것만)·평균(창 안 값이 모두 있을 때만)
function rollMax(a, k) { const o = nan(a.length);
  for (let j = 0; j < a.length; j++) { let m = NaN; for (let i = Math.max(0, j - k + 1); i <= j; i++) if (isFinite(a[i])) m = isFinite(m) ? Math.max(m, a[i]) : a[i]; o[j] = m; } return o; }
function rollMean(a, k) { const o = nan(a.length);
  for (let j = k - 1; j < a.length; j++) { let s = 0, ok = true; for (let i = j - k + 1; i <= j; i++) { if (!isFinite(a[i])) { ok = false; break; } s += a[i]; } if (ok) o[j] = s / k; } return o; }
// 신용융자 월간(FINRA, 1997-01~): 날짜 = 해당 월 1일(월말 잔고), 다음 달 셋째 주 발표 → 시차 50일.
// 252거래일(약 12개월) 최고 대비 낙폭(0 이하).
exports.marginDD = D => memo(D, 'mdd', () => { const m = M.series(D, 'MARGIN_FINRA_M', 50), mx = rollMax(m, 252), o = nan(D.n);
  for (let j = 0; j < D.n; j++) if (isFinite(m[j]) && mx[j] > 0) o[j] = m[j] / mx[j] - 1; return o; });
// AAII 강세 − 약세 스프레드(1987-09~ 주간, 날짜 = 발표 목요일) → 시차 1일. 20거래일(약 4주) 평균.
// 자료 버그(2026-10-24 S30 check에서 발견): 받은 파일의 열이 밀려 있다. AAII_BEAR.csv가 실제 강세−약세 스프레드
// (2009-03-05 −0.5135 = 강세 18.92% − 약세 70.27%, 2025-04-03 −0.4016 = 21.8% − 61.9%로 공개 기록과 일치, 범위 −0.54~+0.63),
// AAII_SPREAD.csv는 (AAII_BULL − AAII_BEAR)라 의미 없는 값(최소 −0.086). 파일을 고칠 때까지 AAII_BEAR.csv를 스프레드로 읽는다.
exports.aaii20 = D => memo(D, 'aaii20', () => rollMean(M.series(D, 'AAII_BEAR', 1), 20));
// k거래일 안에 한 번이라도 켜졌으면 1
exports.memory = (on, k) => { const o = new Uint8Array(on.length); let last = -1e9;
  for (let j = 0; j < on.length; j++) { if (on[j]) last = j; o[j] = j - last < k ? 1 : 0; } return o; };
// VRP(Bollerslev·Tauchen·Zhou 2009): VIX²(연율 분산) − S&P500 21거래일 실현분산(연율). 둘 다 시장 전체(S&P) 기준이라 세트와 무관.
// VIX(FRED VIXCLS 1990~)·S&P(Y_SPX) 모두 시차 1일(보수적). 756일 z(M.z).
exports.vrpZ = D => memo(D, 'vrpz', () => { const v = M.series(D, 'VIXCLS', 1), s = M.series(D, 'Y_SPX', 1), r = nan(D.n), o = nan(D.n);
  for (let j = 1; j < D.n; j++) if (s[j] > 0 && s[j - 1] > 0) r[j] = Math.log(s[j] / s[j - 1]);
  for (let j = 21; j < D.n; j++) { if (!isFinite(v[j])) continue; let q = 0, ok = true;
    for (let i = j - 20; i <= j; i++) { if (!isFinite(r[i])) { ok = false; break; } q += r[i] * r[i]; }
    if (ok) o[j] = (v[j] / 100) ** 2 - q / 21 * 252; }
  return M.z(o); });
// Cboe SKEW(1990~ 일간), 시차 1일, 756일 z
exports.skewZ = D => memo(D, 'skewz', () => M.z(M.series(D, 'CBOE_SKEW', 1)));
