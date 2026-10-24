// S32 공통 도우미(신호 모듈 아님). 아직 안 쓴 출처: CFTC COT TFF(E-mini 나스닥100·S&P500 자산운용사 순포지션/OI amnet_oi, 2006-06~ 주간),
// 소매 MMF 잔고(FRED WRMFNS, 1980~ 주간, 시차 10일), AAII 강세−약세 스프레드(1987~ 주간, 시차 1일; S30 B와 다른 쓰임 = 복귀 금지).
// 모든 값은 j일 종가까지 공개된 것만(관측일 + 시차일에 공개, 앞값 채움, 마지막 관측 90일 뒤 NaN). 자료 없는 날은 NaN → 요소 꺼짐.
const fs = require('fs'), path = require('path'), M = require('../lib/macro.js');
const DIR = path.join(__dirname, '..', '..', 'data', 'macro'), day = s => Math.round(Date.parse(s) / 864e5);
const nan = n => new Float64Array(n).fill(NaN);
const cache = new Map();
const memo = (D, name, f) => { const k = name + '|' + D.n + '|' + D.day[0] + '|' + D.day[D.n - 1]; if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
// 여러 열 CSV에서 한 열을 macro.series와 같은 방식으로 정렬(관측일 + lag일에 공개, 앞값 채움, 마지막 관측 90일 뒤 NaN)
function seriesCol(D, file, col, lag) {
  const rows = fs.readFileSync(path.join(DIR, file + '.csv'), 'utf8').trim().split('\n'), hd = rows[0].split(','), c = hd.indexOf(col);
  if (c < 1) throw new Error(`${file}: 열 ${col} 없음`);
  const obs = rows.slice(1).map(r => r.split(',')).filter(r => r[0] && isFinite(parseFloat(r[c]))).map(r => [day(r[0].slice(0, 10)) + lag, parseFloat(r[c])]).sort((a, b) => a[0] - b[0]);
  const a = nan(D.n), last = obs.length ? obs[obs.length - 1][0] : -1e9; let k = -1;
  for (let i = 0; i < D.n; i++) { while (k + 1 < obs.length && obs[k + 1][0] <= D.day[i]) k++; if (k >= 0 && D.day[i] <= last + 90) a[i] = obs[k][1]; }
  return a;
}
exports.seriesCol = seriesCol;
// COT TFF 자산운용사(asset manager) 순포지션/OI: 화요일 기준, 금요일 공표 → 시차 4일. 나스닥100·S&P500 각각 756일 z, 있는 것만 평균.
exports.amZ = D => memo(D, 'amz', () => {
  const zs = ['COT_TFF_NQ', 'COT_TFF_ES'].map(f => M.z(seriesCol(D, f, 'amnet_oi', 4))), o = nan(D.n);
  for (let j = 0; j < D.n; j++) { let s = 0, c = 0; for (const z of zs) if (isFinite(z[j])) { s += z[j]; c++; } if (c) o[j] = s / c; }
  return o; });
// 소매 MMF 잔고(WRMFNS, 십억 달러, 주간 월요일 기준, H.6) → 시차 10일. 126거래일(약 26주) 증가율의 756일 z.
// 금리 수준·장기 추세로 잔고가 늘어나는 몫은 3년 z가 일부 걸러 낸다(급증만 극단값).
exports.mmfZ = D => memo(D, 'mmfz', () => M.z(M.pctChange(M.series(D, 'WRMFNS', 10), 126)));
// AAII 강세−약세 20거래일 평균(S30_common.aaii20과 같은 값)
exports.aaii20 = D => require('./S30_common.js').aaii20(D);
