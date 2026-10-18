// S12 B 인플레 국면 합의 복귀 금지: 달러 6개월 상승·PPI 전년비·유가 6개월 상승 z점수 중 need개 이상이 z 초과면 복귀 금지
const K = require('../lib/catalog.js');
module.exports = (D, p) => {
  const zs = ['x_dxy', 'i_ppi', 'x_oil'].map(k => K.zOf(D, k).z), b = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) { let c = 0; for (const z of zs) if (z[j] > p.z) c++; b[j] = c >= p.need ? 1 : 0; }
  return { reentryBlock: b };
};
