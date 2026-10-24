// 최종 전략 v2 복제(2026-10-24 채택, S26 A): S09_lib(v1 복제) + 챔피언 자체 규칙 base{월초 창 +1표, 인플레 복귀 금지}.
// 챔피언 위에 얹는 후보(rule "sig")는 run(D, {훅})을 쓴다. 훅은 S09_lib와 같다(exitVotes는 월초 +1이 반영된 need를 받음).
// 플라시보(A10)는 후보의 훅만 이동하고 base(챔피언 규칙)는 제자리에 둔다. 엔진 v2(monthPad 2, inflBlock)와 보유 상태 일치 확인.
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), V2 = require('../lib/v2.js');
function base(D) { if (!D.ib) D.ib = V2.inflBlock(D); return { win: E.monthWin(D, 2), ib: D.ib }; }
const run = (D, opt = {}) => L.run(D, Object.assign({}, opt, { base: base(D) }));
module.exports = { run, base };
