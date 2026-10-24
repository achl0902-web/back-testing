// S35 공통 도우미(신호 모듈 아님). 세 방향이 각각 다른 출처를 쓴다.
//  - walclGrowth: 연준 총자산 WALCL(주간, 수요일 기준·목요일 장 마감 뒤 공표 → 시차 2일) 126거래일 증가율. 2002-12~
//  - sbCorr: 주식-채권 63거래일 상관. FRED DGS10(1962~, 시차 1일)이라 j일에 아는 것은 j−1일 금리까지 →
//    주식 수익률도 j−1일 것을 써서 같은 날끼리 맞춘다(j일 종가 정보 일부를 버리는 보수적 정렬). 채권 수익률 대리 = −Δ금리.
//    양(+)이면 주식·채권이 함께 움직이는 할인율(인플레) 국면, 음(−)이면 채권이 헤지하는 성장 공포 국면.
//  - baaHeal: Moody's Baa−10년 스프레드(BAA10Y 일간 1986~, 시차 1일)가 63거래일 최고점보다 th%p 이상 내려왔고 20거래일 변화가 음(−)
const M = require('../lib/macro.js'), K = require('../lib/catalog.js');
const memo = new Map();
const key = (D, k) => k + '|' + D.n + '|' + D.day[0] + '|' + D.day[D.n - 1];
const keep = (D, k, f) => { const q = key(D, k); if (!memo.has(q)) memo.set(q, f()); return memo.get(q); };

exports.walclGrowth = D => keep(D, 'walcl', () => {
  const w = M.series(D, 'WALCL', 2), o = new Float64Array(D.n).fill(NaN);
  for (let j = 126; j < D.n; j++) if (w[j] > 0 && w[j - 126] > 0) o[j] = w[j] / w[j - 126] - 1;
  return o;
});

exports.sbCorr = D => keep(D, 'sbc', () => {
  const y = M.series(D, 'DGS10', 1), rs = new Float64Array(D.n).fill(NaN), rb = new Float64Array(D.n).fill(NaN);
  for (let j = 2; j < D.n; j++) {
    if (D.px[j - 1] > 0 && D.px[j - 2] > 0) rs[j] = D.px[j - 1] / D.px[j - 2] - 1;
    if (!isNaN(y[j]) && !isNaN(y[j - 1])) rb[j] = -(y[j] - y[j - 1]);
  }
  // 같은 금리가 이어진 날(휴장·결측 앞값 채움)은 0 변화로 들어가지 않게 빼 둔다
  for (let j = 2; j < D.n; j++) if (rb[j] === 0 && y[j] === y[j - 1] && y[j - 1] === y[j - 2]) rb[j] = NaN;
  return K.helpers.rollCorr(Array.from(rs), Array.from(rb), 63);
});

exports.baaHeal = (D, th) => keep(D, 'baa' + th, () => {
  const b = M.series(D, 'BAA10Y', 1), mx = K.helpers.rollMax(Array.from(b), 63), o = new Uint8Array(D.n);
  for (let j = 63; j < D.n; j++) if (!isNaN(b[j]) && !isNaN(b[j - 20]) && !isNaN(mx[j]) && mx[j] - b[j] >= th - 1e-9 && b[j] - b[j - 20] < 0) o[j] = 1;
  return o;
});
