// S35 B (보호기간 재이탈만, 크로스에셋 상관 출처: 주식-채권 63일 상관, DGS10 1962~): 복귀 후 40거래일 보호기간 안에서
// 주식-채권 상관이 th 이상(할인율·인플레 국면: 주식과 채권이 같이 떨어짐)이면 재이탈 문턱 3표→2표(보통 때 문턱으로 되돌림).
// 보호기간 밖 이탈, 매크로 경보, 복귀 조건, 인플레 복귀 금지는 챔피언 v2 그대로.
const C = require('./champ_v2.js'), U = require('./S35_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 0.2, c = U.sbCorr(D), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = c[j] >= th ? 1 : 0;
  const r = C.run(D, { exitVotes: (j, need) => (on[j] && need === 3 ? 2 : need) });
  return Object.assign(r, { sbPos: on });
};
