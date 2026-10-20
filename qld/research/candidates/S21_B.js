// S21 B (약점: 2020 −8.2·2025 −3.2 V자 반등 뒤 늦은 복귀, S&P 2배 중앙값 열위): 복귀 판정에서만 축①의 상방 변동성 문턱을
// 35% 대신 upRe로 본다(하방 30%·축②③④·20일선 위·10일<60일 변동성은 그대로). 상방 변동성은 하락 위험 신호가 아니라
// 반등의 크기인데, 챔피언은 급반등의 상방 변동성을 '켜진 축'으로 세어 바닥 직후 복귀를 막는다는 가설.
// 이탈·복귀 후 40일 보호기간·매크로 경보는 챔피언과 동일. S09_lib.run의 timeout(N=0) 훅 = 추가 복귀 경로라 플라시보 가능.
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const upRe = p.upRe ?? 0.6, v = D.vols;
  const reAxes = j => { const a = E.axesAt(D, P0, j); return (v.down20[j] > P0.dnHi || v.up20[j] > upRe ? 1 : 0) + (a[1] ? 1 : 0) + (a[2] ? 1 : 0) + (a[3] ? 1 : 0); };
  return L.run(D, { timeout: { N: 0, ok: j => reAxes(j) <= 1 && D.px[j] > D.ma[20][j] && v.rv10[j] < D.v60[j] } });
};
