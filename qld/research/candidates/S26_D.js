// S26 D 조합(규칙 분산+복귀 기억+세금, 가격 자료만): S19 C 문턱 ×0.8·×1·×1.2 챔피언 3개 다수결(d=0.2)에서
// 각 복제에 S21 C 충격 이탈 기억(이탈일 주봉 RSI ≥50·매크로 50% 미만이면 20일선 위·10일<60일 변동성만으로 복귀, timeout N=0)을 넣고,
// 세금은 params.lossHarvest. 값은 과거 최고값 고정. 1960~85 histcheck 재확인 가능.
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const d = p.d ?? 0.2, th = p.rsiShock ?? 50, v = D.vols, n = D.n;
  const mk = s => j => {
    if (j < 61) return 0;
    let a = 0;
    if (v.down20[j] > P0.dnHi * s || v.up20[j] > P0.upHi * s) a++;
    if (D.r10[j] < P0.crash * s) a++;
    if (D.rsiw[j] < 100 - (100 - P0.rsiW) * s) a++;
    if (v.rv10[j] / D.v60[j] > P0.expand * s) a++;
    return a;
  };
  const shock = s => s >= 0 && D.rsiw[s] >= th && !(D.ms[s] >= P0.macroTh);
  const timeout = { N: 0, ok: (j, st) => shock(st.outSince) && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] };
  const R = [L.run(D, { axes: mk(1 - d), timeout }), L.run(D, { timeout }), L.run(D, { axes: mk(1 + d), timeout })];
  const ex = new Uint8Array(n), en = new Uint8Array(n);
  for (let j = 0; j < n; j++) { ex[j] = R[0].exitSig[j] + R[1].exitSig[j] + R[2].exitSig[j] >= 2 ? 1 : 0; en[j] = 1 - ex[j]; }
  return { exitSig: ex, enterSig: en };
};
