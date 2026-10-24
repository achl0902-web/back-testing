// S26 C 조합(복귀 금지+보호기간, 2022형 실패 복귀 겨냥): S12 B 인플레 합의 복귀 금지(z=1.5, 2개 이상, enterOk)
// + S25 B 2년물 252거래일 상승폭 ≥1.5%p 인상 국면에서 복귀 후 보호기간 3표 요구를 2표로(exitVotes). 값은 과거 최고값 고정.
// 자료: PPI·유가·달러·2년물(1976~) → 1960~85 histcheck 재확인 불가(보류 대상).
const L = require('./S09_lib.js'), K = require('../lib/catalog.js'), M = require('../lib/macro.js'), C = require('./S26_common.js');
module.exports = (D, p) => {
  const blk = C.inflBlock(D, K, p.z ?? 1.5, p.need ?? 2), th = p.th ?? 1.5, n = D.n, y = M.series(D, 'DGS2', 1), hike = new Uint8Array(n);
  for (let j = 252; j < n; j++) if (!isNaN(y[j]) && !isNaN(y[j - 252]) && y[j] - y[j - 252] >= th) hike[j] = 1;
  return L.run(D, { exitVotes: (j, need) => (hike[j] && need === 3) ? 2 : need, enterOk: j => !blk[j] });
};
