// S14 C S&P 2배 중앙값 열위 겨냥: 축④(10일/60일 변동성 > 1.6배)는 10일 변동성(지수, 연율)이 floor 이상일 때만 켜짐.
// 저변동 장세(S&P 60일 변동성 8~12%)에서는 작은 흔들림도 1.6배가 되어 위험 없는 '변동성 확대' 표가 된다는 가설.
// 나머지 축·매크로 경보·복귀 조건은 챔피언과 같고, 같은 축 수를 이탈·복귀 모두에 쓴다.
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => L.run(D, {
  axes: j => { const a = E.axesAt(D, P0, j); return a[0] + a[1] + a[2] + (a[3] && D.vols.rv10[j] >= p.floor ? 1 : 0); },
});
