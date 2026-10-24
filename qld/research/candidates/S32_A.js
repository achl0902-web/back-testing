// S32 A (조합, 풀 요소 3개를 값 고정으로 챔피언 v2 위에): MW(S14 B 월말·월초 창 기술 이탈 +1표, pad=2)
// + X4(S14 C 축④ 10일/60일 변동성 확대는 10일 변동성 ≥ 0.25일 때만, 이탈·복귀 축 수 모두)
// + HK(S25 B 2년물이 252거래일 전보다 +1.5%p 이상이면 복귀 후 보호기간 3표 → 2표).
// exitVotes 합치는 순서는 S27 A와 같음: 보호기간(need 3)이고 인상 국면이면 2, 그 뒤 창 안이면 +1. 새 자유 파라미터 0개.
// 1960~85(histcheck): MW·X4는 가격만, HK는 DGS2(1976-06~)라 1977-06 이전 꺼짐. 인플레 금지는 histcheck가 D.ib로 넣음.
const E = require('../../src/engine.js'), C = require('./champ_v2.js'), C7 = require('./S27_common.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const win = E.monthWin(D, 2), floor = 0.25, hike = C7.hike(D, 1.5);
  const r = C.run(D, {
    exitVotes: (j, need) => { const n = (hike[j] && need === 3) ? 2 : need; return win[j] ? n + 1 : n; },
    axes: j => { const a = E.axesAt(D, P0, j); return a[0] + a[1] + a[2] + (a[3] && D.vols.rv10[j] >= floor ? 1 : 0); },
  });
  return Object.assign(r, { monthWin: win, hikeOn: hike });
};
