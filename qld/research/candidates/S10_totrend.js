// A1 이탈 N거래일 경과 뒤 복귀 = 200일선·50일선 위 (변동성 조건 없음), 타임아웃 복귀 뒤 보유 0
const L = require('./S09_lib.js');
module.exports = (D, p) => L.run(D, { timeout: { N: p.N, hold: 0, ok: j => D.px[j] > D.ma[200][j] && D.px[j] > D.ma[50][j] } });
