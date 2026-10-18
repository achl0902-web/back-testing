// T4: extra exit alarm on the first day the index is below its 200-day MA while the 10y yield rose more than k over 126 days
const U = require('./S08_tech_util.js');
module.exports = (D, p) => {
  const k = p.k ?? 0.5, d = U.chg(U.y10(D), 126), st = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) st[j] = U.below200(D, j) && d[j] > k ? 1 : 0;
  return { extraExit: U.onset(st), extraName: '금리 상승 중 200일선 이탈' };
};
