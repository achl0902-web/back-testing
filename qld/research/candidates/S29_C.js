// S29 C (조합: Put/Call 게이트 + 기존 요소, 이탈 문턱): S14 B 달력(월말·월초 창 판정일은 기술 이탈 +1표 요구, pad=2)
// + S14 C 축④ 바닥(10일/60일 변동성 축은 10일 변동성 ≥ 0.25일 때만, 이탈·복귀 축 수 모두) — 값은 과거 최고값 고정.
// 새 요소: Put/Call 10일 평균 z ≤ −th(안일 = 헤지 없는 하락)인 날은 두 완화 요소를 끄고 챔피언 문턱으로 이탈 판정.
// 근거: 두 요소는 휩쏘를 줄이는 '이탈 늦추기'인데, 헤지가 이미 깔린 조정은 되돌림이 잦고 안일한 장의 하락은 깊어진다.
// Put/Call 자료가 없는 날(1995-09 이전, 2004~2006-10)은 게이트가 꺼짐 = 기존 요소 조합(S14 B + S14 C) 그대로 → 1960~85 참고 가능.
const E = require('../../src/engine.js'), C = require('./champ_v2.js'), U = require('./S29_common.js'), C6 = require('./S26_common.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const win = C6.monthWin(D, p.pad ?? 2), floor = p.floor ?? 0.25, th = p.th ?? 0.5, z = U.pcZ(D, 10), calm = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) calm[j] = z[j] <= -th ? 1 : 0;
  const r = C.run(D, {
    exitVotes: (j, need) => (win[j] && !calm[j] ? need + 1 : need),
    axes: j => { const a = E.axesAt(D, P0, j); return a[0] + a[1] + a[2] + (a[3] && (calm[j] || D.vols.rv10[j] >= floor) ? 1 : 0); },
  });
  return Object.assign(r, { pcCalm: calm });
};
