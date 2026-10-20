// S19 B: 매크로 경보 이탈은 복귀 조건이 깨진 날에만. 매크로 경보(비율 50% 새로 돌파) 뒤 W거래일 동안 경보 비율이 50% 이상 유지되면
// 대기하다가, 챔피언 복귀 조건(켜진 축 ≤1 · 지수 20일선 위 · 10일 변동성 < 60일 변동성)이 깨진 첫날 이탈한다.
// W=0이면 경보 당일 복귀 조건이 이미 충족돼 있으면 그 경보는 버린다(다음날 바로 복귀하는 하루짜리 이탈 제거).
// 기술 2축/3축 이탈·복귀·복귀 후 40일 매크로 무시는 챔피언과 동일. S09_lib.run의 macro 훅이라 플라시보 가능.
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const W = p.W ?? 0, n = D.n, fire = new Uint8Array(n);
  let onset = -1e9;
  for (let j = 1; j < n; j++) {
    if (E.macroOnset(D, P0, j)) onset = j;
    else if (!(D.ms[j] >= P0.macroTh)) onset = -1e9; // 경보가 꺼지면 대기 해제(지속 조건)
    if (j - onset > W) continue;
    const reOk = L.axes(D, j) <= 1 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j];
    if (!reOk) fire[j] = 1;
  }
  return L.run(D, { macro: j => fire[j] === 1 });
};
