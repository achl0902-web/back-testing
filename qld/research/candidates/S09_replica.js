// 챔피언 복제 + (선택) maxOut 복제: p.N 이탈 거래일 경과 + 20일선 위면 복귀
const L = require('./S09_lib.js');
module.exports = (D, p) => L.run(D, p.N ? { timeout: { N: p.N, ok: j => D.px[j] > D.ma[20][j] } } : {});
