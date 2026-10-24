// S30 C (복귀 시점, 새 출처끼리: VRP + SKEW): 최근 win(20)거래일 안에 VRP(VIX² − S&P 21일 실현분산)의 756일 z가 th 이상(실현 변동성은 가라앉았는데
// 내재 변동성 공포 프리미엄이 큼)이었고 지금 Cboe SKEW 756일 z가 0 이하(추가 꼬리 헤지 수요 없음)면 복귀 때 켜진 축을 2개까지 허용.
// (첫 check에서 당일 조건은 챔피언과 0~12일만 달라 S29 A처럼 20거래일 기억으로 바꿈: plan changes 참고)
// 나머지 복귀 조건(나스닥100 20일선 위 · 10일 < 60일 변동성 · 인플레 과열 복귀 금지)과 복귀 후 40거래일 보호기간은 챔피언 그대로.
// 복귀만에 작용(champ_v2 timeout 훅 N=0, 챔피언 복귀가 안 될 때만 추가 경로). 1990 이전(+756일 z 준비 기간)은 자료 없음 → 챔피언과 같음.
const C = require('./champ_v2.js'), U = require('./S30_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 1.0, v = U.vrpZ(D), s = U.skewZ(D), hi = new Uint8Array(D.n), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) hi[j] = v[j] >= th ? 1 : 0;
  const mem = U.memory(hi, p.win ?? 20);
  for (let j = 0; j < D.n; j++) on[j] = mem[j] && s[j] <= 0 ? 1 : 0;
  const r = C.run(D, { timeout: { N: 0, ok: (j, st) => on[j] && st.a <= 2 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] } });
  return Object.assign(r, { vrpCalm: on });
};
