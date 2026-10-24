// S27 A의 1960~85 재확인판(lib/histcheck.js 전용, 연구 후보 아님). 규칙·값은 S27_A.js와 같고 자료만 대체:
// 유가 WTISPLC·달러 TWEXMMTH 월간 시차 35일, PPIACO 시차 50일(T14_A.js 방식). 2년물은 data/macro/DGS2.csv(1976-06~) 그대로 →
// 1977-06 이전은 인상 국면 꺼짐(NaN, 그 기간 보호기간은 챔피언과 같이 3표).
const K = require('../lib/catalog.js'), C7 = require('./S27_common.js'), A = require('./S27_A.js');
module.exports = (D, p) => A(D, p, null, null, { blk: C7.inflBlockHist(D, K, p.z ?? 1.5, p.need ?? 2), hike: C7.hikeHist(D, p.th ?? 1.5) });
