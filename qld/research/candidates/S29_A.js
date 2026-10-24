// S29 A (복귀 시점, 공포·탐욕 단독): 최근 20거래일 안에 공포·탐욕이 lo 이하(극단적 공포 = 투매)였으면,
// 복귀 때 켜진 축을 2개까지 허용한다(챔피언은 1개 이하). 나머지 복귀 조건(나스닥100 20일선 위 · 10일 < 60일 변동성 ·
// 인플레 과열 복귀 금지)과 복귀 후 40거래일 보호기간은 챔피언 그대로. 복귀만에 작용(이탈은 챔피언 그대로).
// 구현: champ_v2 run의 timeout 훅(N=0)으로 챔피언 복귀가 안 될 때만 추가 경로를 연다(인플레 금지 중에는 엔진 쪽에서 막힘).
// 공포·탐욕은 2011-01~만 있음 → 그 전(게이트의 1986~2010 대부분, 1960~85)은 NaN = 꺼짐 = 챔피언과 같음.
const C = require('./champ_v2.js'), U = require('./S29_common.js');
module.exports = (D, p) => {
  const lo = p.lo ?? 15, mn = U.rollMin(U.fg(D), p.win ?? 20), fear = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) fear[j] = mn[j] <= lo ? 1 : 0;
  const r = C.run(D, { timeout: { N: 0, ok: (j, st) => fear[j] && st.a <= 2 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] } });
  return Object.assign(r, { fearMem: fear });
};
