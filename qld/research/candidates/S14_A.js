// S14 A 판정 주기: 보통 신호(기술 2축 이탈·복귀)는 주 첫 거래일 종가에서만 판정, 강신호(3축 이상·매크로 경보)는 매일 판정.
// side 1: 복귀만 주간 · 2: 보통 이탈만 주간 · 3: 둘 다 주간. 주 첫날 = week[j] != week[j-1] (j일까지만 사용).
// 주간 판정은 그날의 상태만 본다(지난 주 중 켜졌다 꺼진 신호는 무시 = 일중 잡음 거르기).
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const n = D.n, side = p.side, HOLD = 39, ex = new Uint8Array(n), en = new Uint8Array(n);
  const wEnter = side === 1 || side === 3, wExit = side === 2 || side === 3;
  let out = false, inSince = -1e9;
  for (let j = 1; j < n; j++) {
    const a = L.axes(D, j), wk = D.week[j] !== D.week[j - 1], inHold = j - inSince <= HOLD;
    const macro = !!E.macroOnset(D, P0, j) && !inHold;
    if (!out) {
      const strong = a >= 3 || macro;
      const ord = !inHold && a >= 2 && (!wExit || wk);
      if (strong || ord) out = true;
    } else if (a <= 1 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] && (!wEnter || wk)) { out = false; inSince = j; }
    ex[j] = out ? 1 : 0; en[j] = out ? 0 : 1;
  }
  return { exitSig: ex, enterSig: en };
};
