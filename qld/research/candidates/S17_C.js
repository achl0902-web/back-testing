// S17 C: S16 B 3배 + 3배 보유 중에는 레버리지 환산 이탈: 축①(하방 30%/상방 35%)·축②(10일 -8%) 문턱에 s(이론값 2/3)를 곱한 4축이
// 2개 이상이면 전량 이탈(extraExit). 축③ RSI·축④ 변동성 비율은 무차원이라 그대로. 매크로 경보·복귀 규칙은 챔피언과 동일.
// extraExit가 보유 상태를 바꾸므로 챔피언 상태기계(S09_lib과 동일 로직)를 자체 실행해 보유 일수를 맞춘다. 인덱스 j는 j일 종가까지만 사용.
const L = require('./S09_lib.js');
const E = require('../../src/engine.js');
module.exports = (D, p) => {
  const n = D.n, s = p.s, H = p.H, v = D.vols, b = new Uint8Array(n), xe = new Uint8Array(n), HOLD = 39;
  const sax = j => ((v.down20[j] > 0.30 * s || v.up20[j] > 0.35 * s) ? 1 : 0) + (D.r10[j] < -0.08 * s ? 1 : 0)
    + (D.rsiw[j] < 45 ? 1 : 0) + ((D.v60[j] > 0 && v.rv10[j] / D.v60[j] > 1.6) ? 1 : 0);
  let out = false, inSince = -1e9, age = 0; // age = j-1일까지 연속 보유 일수 (S16 B와 같은 정의)
  for (let j = 1; j < n; j++) {
    const a = L.axes(D, j);
    const macro = !!E.macroOnset(D, E.DEFAULTS, j) && !(j - inSince <= HOLD);
    if (!out) {
      const need = (j - inSince <= HOLD) ? 3 : 2;
      xe[j] = (age >= H && sax(j) >= 2) ? 1 : 0;
      if (a >= need || macro || xe[j]) out = true;
    } else if (a <= 1 && D.px[j] > D.ma[20][j] && v.rv10[j] < D.v60[j]) { out = false; inSince = j; }
    age = out ? 0 : age + 1;
    b[j] = age >= H ? 1 : 0;
  }
  return { boostSig: b, extraExit: xe };
};
