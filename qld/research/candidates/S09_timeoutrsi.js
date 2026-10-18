// 아이디어3 이탈 기간 상한 p.N거래일, 확인 조건 = 주봉 RSI >= 50 (20일선 대신)
const L = require('./S09_lib.js');
module.exports = (D, p) => L.run(D, { timeout: { N: p.N, ok: j => D.rsiw[j] >= 50 } });
