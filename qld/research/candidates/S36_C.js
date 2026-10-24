// S36 C (복귀만 · 연준 긴축 국면 복귀 금지, Conover·Jensen·Johnson·Mercer 2005 FAJ · Lunde & Timmermann CEPR DP4104):
// 연방기금 실효금리(DFF 일간, 시차 1일) 21일 평균이 63거래일 전보다 th%p 이상 높으면(빠른 긴축 국면) 복귀 금지.
// 이탈, 보호기간, 인플레 복귀 금지(INF)는 챔피언 v2 그대로. 금지는 긴축 중에만 걸려 완화기 바닥(2002·2009·2020)은 막지 않는다.
const C = require('./champ_v2.js'), U = require('./S36_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 0.75, d = U.dffTight(D), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = d[j] >= th - 1e-9 ? 1 : 0;
  const r = C.run(D, { enterOk: j => !on[j] });
  return Object.assign(r, { fedTight: on });
};
