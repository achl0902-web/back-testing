// S19 A: 문턱 램프 투표. 챔피언 4축의 0/1 계단을 문턱 ±w 구간의 선형 램프(0~1)로 바꿔 축 점수를 합산한다.
// 각 축 비율 m(문턱=1): ① max(하방20/0.30, 상방20/0.35) ② r10/(−0.08) ③ (100−주봉RSI)/(100−45) ④ (rv10/v60)/1.6
// 축 점수 = clamp(0.5 + (m−1)/(2w), 0, 1). 이탈 ≥2(복귀 후 40일 ≥3)·복귀 ≤1·매크로 경보는 챔피언과 동일. w→0이면 챔피언.
// S09_lib.run의 axes 훅이라 플라시보 가능. 인덱스 j는 j일 종가까지만 사용.
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const w = p.w ?? 0.2, v = D.vols;
  const ramp = m => (isFinite(m) ? Math.max(0, Math.min(1, 0.5 + (m - 1) / (2 * w))) : 0);
  const axes = j => {
    if (j < 61) return 0;
    const m1 = Math.max(v.down20[j] / P0.dnHi, v.up20[j] / P0.upHi);
    const m2 = D.r10[j] / P0.crash;
    const m3 = (100 - D.rsiw[j]) / (100 - P0.rsiW);
    const m4 = D.v60[j] > 0 ? (v.rv10[j] / D.v60[j]) / P0.expand : NaN;
    return ramp(m1) + ramp(m2) + ramp(m3) + ramp(m4);
  };
  return L.run(D, { axes });
};
