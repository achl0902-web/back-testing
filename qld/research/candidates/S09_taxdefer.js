// 아이디어5 연말 세금 이연: 연말 마지막 약 K거래일(달력 K*1.4일)에는 기술 이탈에 1표 더 요구. 달력은 미리 알려진 정보
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const cal = Math.round(p.K * 1.4);
  const late = j => { const d = new Date(D.day[j] * 864e5); const ye = Date.UTC(d.getUTCFullYear(), 11, 31); return (ye - d.getTime()) / 864e5 < cal; };
  return L.run(D, { exitVotes: (j, need) => late(j) ? need + 1 : need });
};
