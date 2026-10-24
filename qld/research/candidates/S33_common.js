// S33 공통 도우미(신호 모듈 아님). 새 자료 2개(data/macro):
//  - FOMC_DATES.csv: FOMC 성명 발표일 1994-02~2026-09(279회, 비예정 회의 포함). 발표는 장중(14:15 ET)이라 발표일 종가에 반영 → 시차 0.
//    비예정 회의는 미리 알 수 없으므로 "다음 회의" 날짜는 쓰지 않고 지난 발표일만 쓴다(미래 정보 없음).
//  - FF48_DAILY_VW.csv: Ken French 48개 산업 가치가중 일간 수익률(%), 1926-07~2026-08, −99.99 = 결측.
//    같은 날 종가로 계산되는 값이라 백테스트 시차 0. 단 파일은 매월 갱신(1~2개월 늦음) → 실시간 사용은 섹터 ETF 등으로 대체 필요(goal 참고).
//    마지막 관측(2026-08-31) 뒤 5일이 지나면 NaN → 요소 꺼짐(챔피언과 같음).
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', '..', 'data', 'macro'), day = s => Math.round(Date.parse(s) / 864e5);
const nan = n => new Float64Array(n).fill(NaN);
const cache = new Map();
const memo = (D, name, f) => { const k = name + '|' + D.n + '|' + D.day[0] + '|' + D.day[D.n - 1]; if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

// FOMC: 각 거래일 j에 대해 지난 발표일(발표일 ≥ 그 날짜인 첫 거래일 인덱스 ≤ j)로부터 경과 거래일. 1994-02 이전은 −1.
exports.fomcAge = D => memo(D, 'fomcAge', () => {
  const ds = fs.readFileSync(path.join(DIR, 'FOMC_DATES.csv'), 'utf8').trim().split('\n').slice(1).map(r => day(r.split(',')[0])).sort((a, b) => a - b);
  const ann = new Uint8Array(D.n); let k = 0;
  for (const d of ds) { while (k < D.n && D.day[k] < d) k++; if (k < D.n && D.day[k] - d <= 4) ann[k] = 1; }
  const age = new Int32Array(D.n).fill(-1); let last = -1;
  for (let j = 0; j < D.n; j++) { if (ann[j]) last = j; age[j] = last >= 0 ? j - last : -1; }
  return age;
});
// Cieslak·Morse·Vissing-Jorgensen(2019) FOMC 주기 주 번호: 지난 발표일부터 5거래일 단위(발표일 = 0주). 짝수 주(0·2·4·6)에 초과수익.
// maxW 이하의 짝수 주이면 1. (원 논문의 0주는 발표 전날부터지만, 비예정 회의를 미리 알 수 없어 발표일부터 센다.)
exports.fomcEven = (D, maxW) => { const age = exports.fomcAge(D), o = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) { if (age[j] < 0) continue; const w = Math.floor(age[j] / 5); o[j] = (w % 2 === 0 && w <= maxW) ? 1 : 0; }
  return o; };

// FF48 원자료(파일 자체의 날짜 축): days[], R[t][i](소수 수익률, 결측 NaN)
let FF = null;
function ff48() {
  if (FF) return FF;
  const rows = fs.readFileSync(path.join(DIR, 'FF48_DAILY_VW.csv'), 'utf8').trim().split('\n'), N = rows[0].split(',').length - 1;
  const days = [], R = [];
  for (const r of rows.slice(1)) { const c = r.split(','); if (!c[0]) continue; days.push(day(c[0].slice(0, 10)));
    const x = new Float64Array(N); for (let i = 0; i < N; i++) { const v = parseFloat(c[i + 1]); x[i] = (!isFinite(v) || v <= -99) ? NaN : v / 100; } R.push(x); }
  return (FF = { days, R, N });
}
// 파일 날짜 축의 값 배열을 D 축으로(같은 날 또는 직전 관측, 5일 넘게 비면 NaN)
function align(D, days, v) { const o = nan(D.n); let k = -1;
  for (let j = 0; j < D.n; j++) { while (k + 1 < days.length && days[k + 1] <= D.day[j]) k++; if (k >= 0 && D.day[j] - days[k] <= 5) o[j] = v[k]; }
  return o; }

// 산업 브레드스 스러스트(Zweig 정의의 산업판): 매일 상승 산업 비율(값 있는 산업 중 수익률 > 0)의 10일 EMA가
// 10거래일 안에 0.40 미만에서 hi 초과로 오르면 그날 스러스트. 파일 축에서 계산 후 D 축으로 정렬.
exports.thrust = (D, hi) => memo(D, 'thrust' + hi, () => {
  const { days, R, N } = ff48(), T = days.length, ema = new Float64Array(T), on = new Float64Array(T), a = 2 / 11;
  for (let t = 0; t < T; t++) { let u = 0, c = 0; for (let i = 0; i < N; i++) if (isFinite(R[t][i])) { c++; if (R[t][i] > 0) u++; }
    const f = c >= 20 ? u / c : 0.5; ema[t] = t ? ema[t - 1] + a * (f - ema[t - 1]) : f; }
  for (let t = 10; t < T; t++) { let lo = 1; for (let s = t - 10; s <= t; s++) lo = Math.min(lo, ema[s]); on[t] = (ema[t] > hi && lo < 0.40) ? 1 : 0; }
  const x = align(D, days, on), o = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) o[j] = x[j] === 1 ? 1 : 0; return o; });

// 산업 동조화 지수(흡수비율 근사, Kritzman·Li·Page·Rigobon 2011의 1주성분 대리): 63거래일 창에서
// 동일가중 산업 평균 수익률의 분산 / 개별 산업 분산의 평균(창 63일이 모두 있는 산업만). 1에 가까울수록 한 요인이 시장을 지배(취약).
// 표준화 변화(Kritzman 2011의 AR shift): (15일 평균 − 252일 평균) / 252일 표준편차. ≥ th면 동조화가 빠르게 높아지는 중(정점 전),
// 정점을 지나 내려오면 15일 평균이 1년 평균 아래로 떨어져 꺼진다.
exports.arShift = D => memo(D, 'arShift', () => {
  const { days, R, N } = ff48(), T = days.length, W = 63, ci = new Float64Array(T).fill(NaN);
  for (let t = W - 1; t < T; t++) {
    const ok = []; for (let i = 0; i < N; i++) { let g = true; for (let s = t - W + 1; s <= t; s++) if (!isFinite(R[s][i])) { g = false; break; } if (g) ok.push(i); }
    if (ok.length < 20) continue;
    let mv = 0, ps = 0, ps2 = 0;
    for (const i of ok) { let s1 = 0, s2 = 0; for (let s = t - W + 1; s <= t; s++) { s1 += R[s][i]; s2 += R[s][i] * R[s][i]; } mv += s2 / W - (s1 / W) ** 2; }
    mv /= ok.length;
    for (let s = t - W + 1; s <= t; s++) { let m = 0; for (const i of ok) m += R[s][i]; m /= ok.length; ps += m; ps2 += m * m; }
    const pv = ps2 / W - (ps / W) ** 2; if (mv > 0) ci[t] = pv / mv;
  }
  const sh = new Float64Array(T).fill(NaN);
  for (let t = 252; t < T; t++) { let a = 0, b = 0, b2 = 0, n = 0, ok = true;
    for (let s = t - 14; s <= t; s++) { if (!isFinite(ci[s])) { ok = false; break; } a += ci[s]; }
    for (let s = t - 251; s <= t; s++) if (isFinite(ci[s])) { b += ci[s]; b2 += ci[s] * ci[s]; n++; }
    if (!ok || n < 200) continue; const m = b / n, sd = Math.sqrt(Math.max(b2 / n - m * m, 1e-12)); sh[t] = (a / 15 - m) / sd; }
  return align(D, days, sh); });
// k거래일 안에 한 번이라도 켜졌으면 1
exports.memory = (on, k) => { const o = new Uint8Array(on.length); let last = -1e9;
  for (let j = 0; j < on.length; j++) { if (on[j]) last = j; o[j] = j - last < k ? 1 : 0; } return o; };
