// S34 C (휩쏘 되돌림, 복귀만): 기술 이탈(이탈 신호일에 매크로 경보 신규 발동이 아님) 뒤 K거래일 안에
// 지수 종가가 매도일(신호 다음 날) 종가 위로 돌아오고 20일선 위이며 켜진 축이 2개 이하(이탈 때보다 늘지 않음)면 즉시 복귀.
// 10일<60일 변동성 조건만 건너뛴다(급락일이 10일 창에 남아 있는 동안 기계적으로 막히는 조건). 인플레 복귀 금지는 그대로(엔진 timeout 경로가 확인),
// 복귀 뒤 40거래일 보호기간도 그대로. K일이 지나면 챔피언 복귀 규칙만 남는다.
// 플라시보 주의: 이탈 시점에 묶인 상태 의존 규칙이라 훅을 시간 이동하면 거의 꺼진다(A10은 사실상 '점수 > 0' 검정).
const E = require('../../src/engine.js'), C = require('./champ_v2.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const K = p.K ?? 10;
  const r = C.run(D, {
    timeout: { N: 0, ok: (j, st) => { const s = st.outSince, t = s + 1;
      if (s < 0 || j <= t || j - s > K) return false;
      if (E.macroOnset(D, P0, s)) return false;
      return st.a <= 2 && D.px[j] > D.px[t] && D.px[j] > D.ma[20][j]; } },
  });
  return r;
};
