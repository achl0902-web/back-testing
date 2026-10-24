// S27 B 조합 = S26 A + S21 C: S14 B 달력(pad=2, exitVotes) + S12 B 인플레 합의 복귀 금지(z=1.5, 2개, enterOk)
// + S21 C 충격 이탈 기억(이탈일 주봉 RSI ≥50 · 매크로 50% 미만이면 켜진 축 수 조건 없이 20일선 위 · 10일<60일 변동성으로 복귀, timeout N=0).
// 합칠 때: 충격 복귀 경로도 인플레 복귀 금지를 따른다(S12 B는 모든 복귀를 막는 요소). 값은 과거 최고값 고정. 재확인은 S27_B_hist.js.
const L = require('./S09_lib.js'), K = require('../lib/catalog.js'), C = require('./S26_common.js'), C7 = require('./S27_common.js');
module.exports = (D, p, H, Lo, X) => {
  const win = C.monthWin(D, p.pad ?? 2), blk = X ? X.blk : C.inflBlock(D, K, p.z ?? 1.5, p.need ?? 2), shock = C7.shock(D, p.rsiShock ?? 50);
  const out = L.run(D, {
    exitVotes: (j, need) => win[j] ? need + 1 : need,
    enterOk: j => !blk[j],
    timeout: { N: 0, ok: (j, st) => !blk[j] && shock(st.outSince) && C7.shockOk(D, j) },
  });
  if (X) out.inflBlock = blk;
  return out;
};
