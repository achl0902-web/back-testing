// S19 C: 규칙 분산(문턱 흔든 챔피언 3개 다수결). 챔피언 4축 문턱을 민감 쪽(×(1−d), RSI·급락은 같은 방향으로 민감)·원래·둔감 쪽(×(1+d))
// 으로 둔 챔피언 상태기계 3개를 각자 돌리고, 2개 이상이 이탈 중이면 이탈, 2개 이상 보유 중이면 보유.
// 각 복제는 S09_lib.run(axes 훅)이라 플라시보 가능. 매크로 경보·복귀 조건·보호기간은 각 복제에서 챔피언과 동일.
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const d = p.d ?? 0.15, v = D.vols, n = D.n;
  const mk = s => j => { // s<1 민감, s>1 둔감
    if (j < 61) return 0;
    let a = 0;
    if (v.down20[j] > P0.dnHi * s || v.up20[j] > P0.upHi * s) a++;
    if (D.r10[j] < P0.crash * s) a++;
    if (D.rsiw[j] < 100 - (100 - P0.rsiW) * s) a++;
    if (v.rv10[j] / D.v60[j] > P0.expand * s) a++;
    return a;
  };
  const R = [L.run(D, { axes: mk(1 - d) }), L.run(D), L.run(D, { axes: mk(1 + d) })];
  const ex = new Uint8Array(n), en = new Uint8Array(n);
  for (let j = 0; j < n; j++) { const o = R[0].exitSig[j] + R[1].exitSig[j] + R[2].exitSig[j]; ex[j] = o >= 2 ? 1 : 0; en[j] = 1 - ex[j]; }
  return { exitSig: ex, enterSig: en };
};
