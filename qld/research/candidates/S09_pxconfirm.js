// 아이디어6 이탈 확인: 기술 표 이탈은 지수 < m일선일 때만 (매크로 경보 이탈은 그대로)
const L = require('./S09_lib.js');
module.exports = (D, p) => L.run(D, { exitVeto: j => !(D.px[j] < D.ma[p.m][j]) });
