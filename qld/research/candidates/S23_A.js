// S23 A (복귀 가속 / 약점: 2020·2025형 V자 반등 뒤 늦은 복귀): 이탈 중 지수가 VCP 돌파(3블록×Lb일 기반의 낙폭이
// 줄어든 뒤 종가가 기반 고점 위)를 내면 챔피언 복귀 조건(축 ≤1·20일선 위·10일<60일 변동성)을 기다리지 않고 복귀.
// 챔피언 이탈·복귀 후 40일 보호기간은 그대로. S09_lib.run의 timeout(N=1) 훅이라 플라시보 가능.
const L = require('./S09_lib.js'), V = require('./S23_vcp.js');
module.exports = (D, p) => {
  const b = V.breakout(D, p.Lb ?? 15);
  return L.run(D, { timeout: { N: 1, ok: j => b[j] === 1 } });
};
