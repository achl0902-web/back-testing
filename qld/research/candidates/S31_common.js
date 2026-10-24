// S31 공통 도우미(신호 모듈 아님). 아직 안 쓴 출처: CFTC COT Legacy(E-mini 나스닥100·S&P500 비상업 순포지션/OI, 1996~ 주간),
// VIX 기간구조(VIXCLS / VXVCLS = VIX / VIX3M, 2007-12~), 은행 대출 기준 SLOOS(DRTSCILM, C&I 대출 기준을 조인 은행 순비율, 1990~ 분기).
// 모든 값은 j일 종가까지 공개된 것만(macro.series: 관측일 + 시차일에 공개, 앞값 채움, 마지막 관측 90일 뒤 NaN). 자료 없는 날은 NaN → 요소 꺼짐.
const M = require('../lib/macro.js');
const nan = n => new Float64Array(n).fill(NaN);
const cache = new Map();
const memo = (D, name, f) => { const k = name + '|' + D.n + '|' + D.day[0] + '|' + D.day[D.n - 1]; if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
// COT Legacy: 화요일 기준 포지션, 금요일 공표 → 시차 4일. 비상업(대형 투기자) 순포지션/미결제약정.
// 나스닥100(1996-04~)·S&P500(1997-09~) 각각 756일 z를 구하고, 있는 것만 평균(Wang 2003의 3년 COT 지수와 같은 창).
exports.cotZ = D => memo(D, 'cotz', () => {
  const zs = ['COT_LEGACY_NQ', 'COT_LEGACY_ES'].map(f => M.z(M.series(D, f, 4))), o = nan(D.n);
  for (let j = 0; j < D.n; j++) { let s = 0, c = 0; for (const z of zs) if (isFinite(z[j])) { s += z[j]; c++; } if (c) o[j] = s / c; }
  return o; });
// VIX / VIX3M(둘 다 FRED 일간, 시차 1일). 1 이상이면 기간구조 역전(백워데이션 = 급성 공포). VIX3M 2007-12-04 이전 NaN.
exports.tsRatio = D => memo(D, 'ts', () => { const v = M.series(D, 'VIXCLS', 1), w = M.series(D, 'VXVCLS', 1), o = nan(D.n);
  for (let j = 0; j < D.n; j++) if (v[j] > 0 && w[j] > 0) o[j] = v[j] / w[j]; return o; });
// SLOOS C&I 대출 기준 강화 순비율(%), 분기(관측일 = 조사 분기 첫날, 발표 약 5~6주 뒤) → 시차 45일.
exports.sloos = D => memo(D, 'sloos', () => M.series(D, 'DRTSCILM', 45));
