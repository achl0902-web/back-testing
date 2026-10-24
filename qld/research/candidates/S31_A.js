// S31 A (조합, 풀 요소 3개를 값 고정으로 챔피언 v2 위에): MW(S14 B 월말·월초 창 기술 이탈 +1표, pad=2)
// + X4(S14 C 축④ 10일/60일 변동성 확대는 10일 변동성 ≥ 0.25일 때만, 이탈·복귀 축 수 모두)
// + VRS(S30 C: 최근 20거래일 안에 VRP 756일 z ≥ 1이었고 지금 SKEW 756일 z ≤ 0이면 켜진 축 2개까지 복귀, 나머지 복귀 조건 그대로).
// 새 자유 파라미터 0개. MW·X4는 이탈 쪽 휩쏘 감소, VRS는 복귀 쪽 앞당김이라 서로 다른 날에 작용(가산 가설).
// 1960~85(histcheck): VIX·SKEW 자료 없음 → VRS 꺼짐, MW+X4만 작용.
const E = require('../../src/engine.js'), C = require('./champ_v2.js'), U = require('./S30_common.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const win = E.monthWin(D, 2), floor = 0.25, v = U.vrpZ(D), s = U.skewZ(D), hi = new Uint8Array(D.n), vrs = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) hi[j] = v[j] >= 1.0 ? 1 : 0;
  const mem = U.memory(hi, 20);
  for (let j = 0; j < D.n; j++) vrs[j] = mem[j] && s[j] <= 0 ? 1 : 0;
  const r = C.run(D, {
    exitVotes: (j, need) => (win[j] ? need + 1 : need),
    axes: j => { const a = E.axesAt(D, P0, j); return a[0] + a[1] + a[2] + (a[3] && D.vols.rv10[j] >= floor ? 1 : 0); },
    timeout: { N: 0, ok: (j, st) => vrs[j] && st.a <= 2 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] },
  });
  return Object.assign(r, { monthWin: win, vrpCalm: vrs });
};
