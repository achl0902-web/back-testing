// S09 공통: 챔피언(final) 규칙 복제 상태기계 + 행동 훅. 인덱스 j는 j일 종가까지만 사용.
// opt: exitVotes(j,base)->필요 표수, extraExit(j)->bool, enterOk(j,st)->bool(추가 조건), timeout{N,ok(j)}
const E = require('../../src/engine.js');
const P0 = E.DEFAULTS;
function axes(D, j) {
  return E.axesAt(D, P0, j).reduce((x, y) => x + (y ? 1 : 0), 0);
}
function axesOld(D, j) {
  const v = D.vols;
  let n = 0;
  if (v.down20[j] > 0.30 || v.up20[j] > 0.35) n++;
  if (D.r10[j] < -0.08) n++;
  if (D.rsiw[j] < 45) n++;
  if (D.v60[j] > 0 && v.rv10[j] / D.v60[j] > 1.6) n++;
  return n;
}
function run(D, opt = {}) {
  const n = D.n, ex = new Uint8Array(n), en = new Uint8Array(n);
  let out = false, outSince = -1, inSince = -1e9;
  const HOLD = opt.hold || 39; // 엔진 final과 일치(검증: 점수 0.00, 이탈 32)
  for (let j = 1; j < n; j++) {
    const a = axes(D, j);
    const macro = !!E.macroOnset(D, P0, j) && !(opt.macroHold !== false && j - inSince <= HOLD);
    if (!out) {
      let need = (j - inSince <= HOLD) ? 3 : 2;
      if (opt.exitVotes) need = opt.exitVotes(j, need);
      if ((a >= need && !(opt.exitVeto && opt.exitVeto(j))) || macro || (opt.extraExit && opt.extraExit(j))) { out = true; outSince = j; }
    } else {
      let ok = a <= 1 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j];
      if (ok && opt.enterOk) ok = opt.enterOk(j, { outSince });
      if (!ok && opt.timeout && j - outSince >= opt.timeout.N && opt.timeout.ok(j)) ok = true;
      if (ok) { out = false; inSince = j; }
    }
    ex[j] = out ? 1 : 0; en[j] = out ? 0 : 1;
  }
  return { exitSig: ex, enterSig: en };
}
module.exports = { axes, run };
