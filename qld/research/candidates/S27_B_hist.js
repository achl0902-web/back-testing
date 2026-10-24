// S27 B의 1960~85 재확인판(lib/histcheck.js 전용, 연구 후보 아님). 규칙·값은 S27_B.js와 같고 인플레 자료만 T14_A.js 방식으로 대체
// (유가 WTISPLC·달러 TWEXMMTH 월간 시차 35일, PPIACO 시차 50일, 1973 이전 달러 NaN). 달력·충격 기억은 가격 자료라 그대로.
const K = require('../lib/catalog.js'), C7 = require('./S27_common.js'), B = require('./S27_B.js');
module.exports = (D, p) => B(D, p, null, null, { blk: C7.inflBlockHist(D, K, p.z ?? 1.5, p.need ?? 2) });
