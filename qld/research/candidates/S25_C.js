// S25 C (보호 기간 · 매크로, 약점: 매크로 경보 사각 — 복귀 후 40거래일 안에 새로 켜진 신용 경보는 영영 무시됨):
// 챔피언은 매크로 경보 비율이 50%를 '새로 넘는' 날만 이탈하고, 복귀 후 보호기간 안의 그 날은 버린다. 비율이 50% 위에 머무는 한
// 다시 넘는 날이 없어서, 보호기간에 시작된 신용 경색은 기술 3축이 켜질 때까지 못 잡는다.
// 보호기간 안에서 새로 넘은 매크로 경보도 이탈로 인정한다. 보호기간 밖은 챔피언이 이미 같은 날 이탈하므로 동일.
// 이탈에만 작용, 자유 파라미터 없음(챔피언 문턱 50% 그대로). D.ms(발표 시차 적용됨) j일까지.
// 엔진 extraExit 훅은 보호기간에 막히므로 챔피언 대체형 S09_lib.run(D, {extraExit})로 만든다(S09_lib의 extraExit는 보호기간 무시).
const L = require('./S09_lib.js'), E = require('../../src/engine.js');
module.exports = (D) => {
  const n = D.n, x = new Uint8Array(n), P = E.DEFAULTS;
  for (let j = 1; j < n; j++) x[j] = E.macroOnset(D, P, j) ? 1 : 0;
  return L.run(D, { extraExit: j => x[j] === 1 });
};
