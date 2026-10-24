// S27 A 조합 = S26 A + S25 B: S14 B 달력(월말·월초 창 기술 이탈 +1표, pad=2) + S12 B 인플레 합의 복귀 금지(달러·PPI·유가 z>1.5 중 2개)
// + S25 B 2년물 252거래일 +1.5%p 이상 인상 국면이면 복귀 후 보호기간 3표 요구를 2표로. 두 exitVotes 논리를 합침:
// 보호기간 안(need 3)이고 인상 국면이면 2, 그 뒤 창 안이면 +1(달력은 모든 판정일의 기술 이탈 문턱을 1 올리는 요소라 마지막에 적용).
// 값은 과거 최고값 고정. 1960~85 재확인은 S27_A_hist.js.
const L = require('./S09_lib.js'), K = require('../lib/catalog.js'), C = require('./S26_common.js'), C7 = require('./S27_common.js');
module.exports = (D, p, H, Lo, X) => {
  const win = C.monthWin(D, p.pad ?? 2), blk = X ? X.blk : C.inflBlock(D, K, p.z ?? 1.5, p.need ?? 2), hike = X ? X.hike : C7.hike(D, p.th ?? 1.5);
  const out = L.run(D, {
    exitVotes: (j, need) => { let n = (hike[j] && need === 3) ? 2 : need; return win[j] ? n + 1 : n; },
    enterOk: j => !blk[j],
  });
  if (X) { out.inflBlock = blk; out.hikeOn = hike; }
  return out;
};
