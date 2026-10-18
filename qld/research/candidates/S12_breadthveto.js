// S12 A 시장 폭 이탈 필터: 섹터·규모 8개 중 200일선 아래 비율(x_breadth) < th 이면 기술 이탈에 필요한 표 +1
// (넓은 시장이 멀쩡한 국지 조정은 2축으로 나가지 않음). 매크로 경보 이탈은 그대로. 폭 자료 없는 1999-10 이전은 챔피언과 동일.
const L = require('./S09_lib.js'), K = require('../lib/catalog.js');
module.exports = (D, p) => {
  const br = K.zOf(D, 'x_breadth').raw;
  return L.run(D, { exitVotes: (j, need) => (br[j] < p.th ? need + 1 : need) });
};
