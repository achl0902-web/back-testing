// S21 C (약점: 2020·2025형 충격 하락 뒤 늦은 복귀 / 상태 기억형): 이탈한 날 주봉 RSI가 rsiShock 이상이고 매크로 경보 비율이
// 50% 미만이었으면 '충격 이탈'(추세 손상 없이 급락·변동성만으로 나감)로 기억한다. 충격 이탈 중에는 켜진 축 수와 무관하게
// 지수 20일선 위 · 10일 변동성 < 60일 변동성이면 복귀(챔피언 복귀 조건에서 '켜진 축 ≤1'만 뺀 경로). 추세가 손상된 뒤의 이탈
// (2000·2008·2022형, 주봉 RSI<rsiShock)과 매크로 이탈은 챔피언 복귀 그대로. S09_lib.run의 timeout(N=0) 훅이라 플라시보 가능.
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const th = p.rsiShock ?? 50;
  const shock = s => s >= 0 && D.rsiw[s] >= th && !(D.ms[s] >= P0.macroTh);
  return L.run(D, { timeout: { N: 0, ok: (j, st) => shock(st.outSince) && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] } });
};
