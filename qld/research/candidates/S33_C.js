// S33 C (조합, 풀 요소 3개 값 고정, MW 없이): X4(S14 C 축④는 10일 변동성 ≥ 0.25일 때만, 이탈·복귀 축 수 모두)
// + HK(S25 B 2년물 252거래일 +1.5%p 인상 국면이면 보호기간 3표→2표) + VRS(S30 C 최근 20거래일 VRP z ≥ 1 · 지금 SKEW z ≤ 0이면 켜진 축 2개까지 복귀).
// 새 자유 파라미터 0개. 지금까지 모든 조합의 이득이 MW 몫이었고 VRS는 MW와 겹칠 때만 손해(S31) → MW를 뺀 작은 요소들이 가산적인지 시험.
// 1960~85(histcheck): VIX·SKEW 없음 → VRS 꺼짐, HK는 DGS2(1976-06~)라 1977-06 이전 꺼짐 → 그 시대는 주로 X4만 검증.
const E = require('../../src/engine.js'), C = require('./champ_v2.js'), C7 = require('./S27_common.js'), U = require('./S30_common.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const floor = 0.25, hike = C7.hike(D, 1.5), v = U.vrpZ(D), s = U.skewZ(D), hi = new Uint8Array(D.n), vrs = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) hi[j] = v[j] >= 1.0 ? 1 : 0;
  const mem = U.memory(hi, 20);
  for (let j = 0; j < D.n; j++) vrs[j] = mem[j] && s[j] <= 0 ? 1 : 0;
  const r = C.run(D, {
    exitVotes: (j, need) => ((hike[j] && need === 3) ? 2 : need),
    axes: j => { const a = E.axesAt(D, P0, j); return a[0] + a[1] + a[2] + (a[3] && D.vols.rv10[j] >= floor ? 1 : 0); },
    timeout: { N: 0, ok: (j, st) => vrs[j] && st.a <= 2 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] },
  });
  return Object.assign(r, { hikeOn: hike, vrpCalm: vrs });
};
