// S25 A (판정 방식 · 신호 확인, 약점: S&P 2배 중앙값 DCA 열위 = 하루짜리 축 급등 휩쏘):
// 기술 이탈은 이탈 조건(켜진 축 >= 필요 표)이 N거래일 연속 종가에서 성립해야 실행한다. 매크로 이탈·복귀 판정은 챔피언 그대로.
// 근거: 축 ②(10일 −8%)·④(10일/60일 변동성 1.6배)는 하루 급락 한 번으로 켜졌다 다음 날 꺼지는 일이 많다. 진짜 하락은 조건이
// 며칠 이어진다. 확인 하루는 깊은 하락에서 비용이 작고(이미 −8% 뒤), 하루짜리 휩쏘는 거른다. 이탈에만 작용.
// 챔피언 대체형: S09_lib.run(D, {exitVotes}) — j−k일 축 수(k<N)도 j일 종가까지의 정보다.
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const N = p.N ?? 2, n = D.n, a = new Int8Array(n);
  for (let j = 1; j < n; j++) a[j] = L.axes(D, j);
  return L.run(D, {
    exitVotes: (j, need) => {
      for (let k = 1; k < N; k++) if (j - k < 1 || a[j - k] < need) return 99;
      return need;
    },
  });
};
