// ⑤ 약한 기술 이탈은 QQQ, 축>=strong 또는 매크로 경보면 현금. 상태 0=QLD 1=QQQ 2=현금
const E = require('../../src/engine.js');
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const n = D.n, ex = new Uint8Array(n), en = new Uint8Array(n), sl = new Uint8Array(n), HOLD = 39, P0 = E.DEFAULTS;
  let st = 0, inSince = -1e9;
  for (let j = 1; j < n; j++) {
    const a = L.axes(D, j);
    const macro = !!E.macroOnset(D, P0, j) && !(j - inSince <= HOLD);
    const need = (j - inSince <= HOLD) ? 3 : 2, strong = Math.max(p.strong, need);
    const ok = a <= 1 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j];
    if (st === 0) { if (macro || a >= strong) st = 2; else if (a >= need) st = 1; }
    else if (st === 1) { if (macro || a >= strong) st = 2; else if (ok) { st = 0; inSince = j; } }
    else if (ok) { st = 0; inSince = j; }
    ex[j] = st === 2 ? 1 : 0; en[j] = st === 2 ? 0 : 1; sl[j] = st === 1 ? 1 : 0;
  }
  return { exitSig: ex, enterSig: en, slowSig: sl };
};
