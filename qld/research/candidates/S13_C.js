// S13 C 매크로 경보 기술 확인: 매크로 경보(비율 50% 새로 돌파)가 켜지면 W거래일 동안 대기하다가
// 기술 축이 1개 이상 켜진 날 이탈(W=0이면 경보 당일 1축 이상일 때만). 기술 2축/3축 이탈·복귀는 챔피언과 동일.
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const n = D.n, W = p.W, K = p.K ?? 1, HOLD = 39, ex = new Uint8Array(n), en = new Uint8Array(n);
  let out = false, inSince = -1e9, pend = -1;
  for (let j = 1; j < n; j++) {
    const a = L.axes(D, j);
    const onset = !!E.macroOnset(D, P0, j) && !(j - inSince <= HOLD);
    if (onset) pend = j + W;
    if (!out) {
      const need = (j - inSince <= HOLD) ? 3 : 2;
      const macro = j <= pend && a >= K;
      if (a >= need || macro) { out = true; pend = -1; }
    } else if (a <= 1 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j]) { out = false; inSince = j; pend = -1; }
    ex[j] = out ? 1 : 0; en[j] = out ? 0 : 1;
  }
  return { exitSig: ex, enterSig: en };
};
