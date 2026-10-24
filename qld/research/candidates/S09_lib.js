// S09 공통: 챔피언(final) 규칙 복제 상태기계 + 행동 훅. 인덱스 j는 j일 종가까지만 사용.
// opt: exitVotes(j,base)->필요 표수, extraExit(j)->bool, enterOk(j,st)->bool(추가 조건), timeout{N,ok(j,st),hold}
// S10 추가(기본값이면 동작 동일): axes(j)->켜진 축 수 대체, timeout.hold===0 이면 타임아웃 복귀 뒤 40일 보유 없음
// S19 추가(기본값이면 동작 동일): macro(j)->bool 매크로 경보 발동일 대체(복귀 후 보호기간 무시 규칙은 그대로 적용)
// v2 추가(2026-10-24, 기본값이면 동작 동일): base{win, ib} = 챔피언 자체의 규칙(월초 창 +1표, 인플레 복귀 금지). 플라시보 이동 대상이 아님
//   → 최종 전략 v2 위의 후보는 candidates/champ_v2.js의 run(D, {훅})을 쓴다
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
  // placebo (lib/shiftsig.js sets module.exports.__shift): evaluate the candidate's hooks k days earlier, keep the champion
  // state machine at the true day → the modification lands at random times, the champion itself stays intact
  module.exports.__used = true;
  const SH = module.exports.__shift || 0;
  if (SH) {
    const sj = j => (((j - SH) % n) + n) % n, o = opt; opt = Object.assign({}, o);
    if (o.axes) opt.axes = j => axes(D, j) + (o.axes(sj(j)) - axes(D, sj(j)));
    for (const k of ['exitVotes', 'exitVeto', 'extraExit', 'enterOk', 'macro']) if (o[k]) opt[k] = (j, x) => o[k](sj(j), x);
    if (o.timeout) opt.timeout = Object.assign({}, o.timeout, { ok: (j, st) => o.timeout.ok(sj(j), st) });
  }
  let out = false, outSince = -1, inSince = -1e9;
  const HOLD = opt.hold || 39; // 엔진 final과 일치(검증: 점수 0.00, 이탈 32)
  for (let j = 1; j < n; j++) {
    const a = opt.axes ? opt.axes(j) : axes(D, j);
    const macro = !!(opt.macro ? opt.macro(j) : E.macroOnset(D, P0, j)) && !(opt.macroHold !== false && j - inSince <= HOLD);
    if (!out) {
      let need = (j - inSince <= HOLD) ? 3 : 2;
      if (opt.base && opt.base.win[j]) need++;
      if (opt.exitVotes) need = opt.exitVotes(j, need);
      if ((a >= need && !(opt.exitVeto && opt.exitVeto(j))) || macro || (opt.extraExit && opt.extraExit(j))) { out = true; outSince = j; }
    } else {
      let ok = a <= 1 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j];
      if (ok && opt.base && opt.base.ib[j]) ok = false;
      if (ok && opt.enterOk) ok = opt.enterOk(j, { outSince });
      let viaT = false;
      if (!ok && opt.timeout && j - outSince >= opt.timeout.N && !(opt.base && opt.base.ib[j]) && opt.timeout.ok(j, { outSince, a })) { ok = true; viaT = true; }
      if (ok) { out = false; inSince = (viaT && opt.timeout.hold === 0) ? -1e9 : j; }
    }
    ex[j] = out ? 1 : 0; en[j] = out ? 0 : 1;
  }
  return { exitSig: ex, enterSig: en };
}
module.exports = { axes, run };
