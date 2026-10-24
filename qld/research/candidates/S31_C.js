// S31 C (복귀 시점, 새 출처 + 풀 요소): VIX 기간구조(VIX/VIX3M, 2007-12~)가 최근 20거래일 안에 역전(≥ 1, 급성 공포)됐고
// 지금 th 이하로 정상(콘탱고)이면 켜진 축 2개까지 복귀 허용. 풀 요소 VRS(S30 C, th=1·20일 기억·SKEW z ≤ 0, 값 고정)와 합침(둘 중 하나면 완화).
// 나머지 복귀 조건(20일선 위 · 10일 < 60일 변동성 · 인플레 과열 복귀 금지)과 40거래일 보호기간은 챔피언 그대로. 복귀만(timeout N=0).
// 2007-12 이전은 VRS만 작용(= 풀 요소 VRS 단독), 1990 이전은 챔피언과 같음.
const C = require('./champ_v2.js'), U0 = require('./S30_common.js'), U = require('./S31_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 0.9, ts = U.tsRatio(D), v = U0.vrpZ(D), s = U0.skewZ(D), bk = new Uint8Array(D.n), hi = new Uint8Array(D.n), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) { bk[j] = ts[j] >= 1 ? 1 : 0; hi[j] = v[j] >= 1.0 ? 1 : 0; }
  const mb = U0.memory(bk, 20), mv = U0.memory(hi, 20), tsOn = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) { tsOn[j] = mb[j] && ts[j] <= th ? 1 : 0; on[j] = tsOn[j] || (mv[j] && s[j] <= 0) ? 1 : 0; }
  const r = C.run(D, { timeout: { N: 0, ok: (j, st) => on[j] && st.a <= 2 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] } });
  return Object.assign(r, { tsCalm: tsOn, relax: on });
};
