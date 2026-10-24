// S24 B (IDEAS 시장 폭 빈칸 "개별 종목 신고가·신저가(데이터 없음)"을 섹터·규모 지수 바스켓의 63일 신저가 비율로 근사 /
// 약점: 2022형 반등 재진입은 시장 폭 데이터 없이는 구별 불가): 최근 W거래일 안에 63일 종가 신저가를 낸 바스켓 구성원이
// 절반 이상이면 복귀 금지(reentryBlock). 신저가가 넓게 퍼지는 동안의 지수 반등은 소수 대형주가 끄는 약세장 반등이고,
// 진짜 바닥은 지수 반등 전에 신저가 수가 먼저 줄어든다(신고가·신저가 지표의 다이버전스). 구성원 3개 미만인 날은 막지 않음.
// 기존 S12 A·T01의 x_breadth는 200일선 아래 비율(추세 폭)이고, 여기는 신저가 확산(하락 폭)이다. Y_ 지수 종가는 같은 시각 → 시차 0.
const M = require('../lib/macro.js');
const KS = ['Y_XLK', 'Y_XLF', 'Y_XLY', 'Y_XLP', 'Y_SOX', 'Y_RUT', 'Y_SPX', 'Y_NDX'];
module.exports = (D, p) => {
  const W = p.W ?? 20, L = 63, F = 0.5, n = D.n, block = new Uint8Array(n);
  const recent = KS.map(k => {
    const a = M.series(D, k, 0), lowDay = new Float64Array(n).fill(NaN), r = new Int8Array(n).fill(-1);
    let last = -1e9;
    for (let j = 0; j < n; j++) {
      if (isNaN(a[j]) || j < L) continue;
      let ok = true, mn = Infinity;
      for (let i = j - L + 1; i <= j; i++) { if (isNaN(a[i])) { ok = false; break; } if (a[i] < mn) mn = a[i]; }
      if (!ok) continue;
      if (a[j] <= mn) last = j;
      r[j] = (j - last < W) ? 1 : 0;
    }
    return r;
  });
  for (let j = 0; j < n; j++) {
    let c = 0, t = 0;
    for (const r of recent) if (r[j] >= 0) { c++; t += r[j]; }
    if (c >= 3 && t / c >= F) block[j] = 1;
  }
  return { reentryBlock: block };
};
