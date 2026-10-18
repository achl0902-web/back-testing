// ⑥ 축 1개 이상 + (gate>0이면 지수 < gate일선) 이면 감속, 축 0개면 해제(그 사이 유지)
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const n = D.n, s = new Uint8Array(n); let on = 0;
  for (let j = 1; j < n; j++) {
    const a = L.axes(D, j), g = p.gate ? D.px[j] < D.ma[p.gate][j] : true;
    if (a >= 1 && g) on = 1; else if (a === 0) on = 0;
    s[j] = on;
  }
  return { slowSig: s };
};
