// A2 이탈 N거래일 경과 뒤 복귀 조건에서 "10일<60일 변동성"만 뺌 (축≤1·20일선 위 유지), 보유 0
const L = require('./S09_lib.js');
module.exports = (D, p) => L.run(D, { timeout: { N: p.N, hold: 0, ok: (j, st) => st.a <= 1 && D.px[j] > D.ma[20][j] } });
