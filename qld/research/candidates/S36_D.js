// S36 D (복귀만 · 규칙 선택기: 주식-채권 상관 레짐 × INF 강도, Vanguard 2021 · Schroders 2022 · Campbell·Sunderam·Viceira 2017):
// 주식-채권 63일 상관(DGS10, S35 공통) ≥ th(인플레·할인율 국면)이면 챔피언 INF의 세 z(달러·PPI·유가, z>1.5 고정) 중 1개만 넘어도 복귀 금지,
// 상관 < th(성장 공포 국면)이면 챔피언 그대로 2개 이상일 때만 금지. 이탈·보호기간·복귀의 기술 조건은 챔피언 v2 그대로.
const C = require('./champ_v2.js'), U = require('./S36_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 0.2, c = U.sbCorr(D), zs = U.infZ(D), on = new Uint8Array(D.n), pos = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) {
    pos[j] = c[j] >= th - 1e-9 ? 1 : 0;
    let k = 0; for (const z of zs) if (z[j] > 1.5) k++;
    on[j] = pos[j] && k === 1 ? 1 : 0; // k ≥ 2는 챔피언 INF가 이미 막음
  }
  const r = C.run(D, { enterOk: j => !on[j] });
  return Object.assign(r, { infPos1: on, sbPos: pos });
};
