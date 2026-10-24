// S33 B (복귀 시점, 새 자료 FF48 산업 일간 1926~): 산업 브레드스 스러스트(상승 산업 비율 10일 EMA가 10거래일 안에 0.40 미만 → hi 초과)가
// 최근 20거래일 안에 있었으면 복귀 때 켜진 축을 2개까지 허용 (복귀만, 앞당김만 하고 늦추지 않음).
// 나머지 복귀 조건(나스닥100 20일선 위 · 10일 < 60일 변동성 · 인플레 과열 복귀 금지)과 복귀 후 40거래일 보호기간은 챔피언 그대로.
// 자료 끝(2026-08-31) 뒤는 꺼짐. 1960~85 histcheck에서도 같은 자료로 작동.
const C = require('./champ_v2.js'), U = require('./S33_common.js');
module.exports = (D, p) => {
  const on = U.memory(U.thrust(D, p.hi ?? 0.65), 20);
  const r = C.run(D, { timeout: { N: 0, ok: (j, st) => on[j] && st.a <= 2 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] } });
  return Object.assign(r, { thrust20: on });
};
