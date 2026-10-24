// S26 A 조합(이탈+복귀): S14 B 달력(월말·월초 창 기술 이탈 +1표, pad=2) + S12 B 인플레 합의 복귀 금지(달러·PPI·유가 z>1.5 중 2개 이상).
// 이탈 쪽은 exitVotes, 복귀 쪽은 enterOk로 S09_lib.run 하나에 합침(플라시보는 두 훅을 함께 이동). 값은 과거 최고값 고정.
// 자료: PPI·유가·달러 → 1960~85 histcheck 재확인 불가(보류 대상).
const L = require('./S09_lib.js'), K = require('../lib/catalog.js'), C = require('./S26_common.js');
module.exports = (D, p) => {
  const win = C.monthWin(D, p.pad ?? 2), blk = C.inflBlock(D, K, p.z ?? 1.5, p.need ?? 2);
  return L.run(D, { exitVotes: (j, need) => win[j] ? need + 1 : need, enterOk: j => !blk[j] });
};
