// A3 이탈 N거래일 경과 뒤 이탈일 종가 회복 + 20일선 위면 복귀, 보유 0
const L = require('./S09_lib.js');
module.exports = (D, p) => L.run(D, { timeout: { N: p.N, hold: 0, ok: (j, st) => D.px[j] > D.px[st.outSince] && D.px[j] > D.ma[20][j] } });
