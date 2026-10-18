// ③ 챔피언 복제로 복귀일을 찾아 복귀 첫 N거래일 QQQ
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const { enterSig: en } = L.run(D), n = D.n, s = new Uint8Array(n);
  let last = -1e9;
  for (let j = 1; j < n; j++) { if (en[j] && !en[j - 1]) last = j; s[j] = (en[j] && j - last < p.N) ? 1 : 0; }
  return { slowSig: s };
};
