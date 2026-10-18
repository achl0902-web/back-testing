// 아이디어7 이탈 후 최소 대기: 이탈 뒤 W거래일 동안 복귀 금지
const L = require('./S09_lib.js');
module.exports = (D, p) => L.run(D, { enterOk: (j, st) => j - st.outSince >= p.W });
