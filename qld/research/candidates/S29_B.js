// S29 B (이탈 시점, 공포·탐욕 + Put/Call 합의): 최근 20거래일 안에 공포·탐욕이 hi 이상(탐욕 과열)이었고
// 지금 Put/Call 5일 평균의 756일 z가 0 이하(헤지 수요 평균 이하 = 안일)면 기술 이탈 표 +1(필요 표 −1, 보호기간 3→2, 평시 2→1).
// 이탈만에 작용(extraVoteExit와 같음), 복귀·매크로 경보·인플레 복귀 금지는 챔피언 그대로.
// 두 자료가 모두 있어야 켜짐: 공포·탐욕 2011-01~ → 그 전은 챔피언과 같음. Put/Call은 2019-10~ 일간 파일을 이어 붙여 2011~ 공백 없음.
const C = require('./champ_v2.js'), U = require('./S29_common.js');
module.exports = (D, p) => {
  const hi = p.hi ?? 75, mx = U.rollMax(U.fg(D), p.win ?? 20), z = U.pcZ(D, 5), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = mx[j] >= hi && z[j] <= (p.pz ?? 0) ? 1 : 0;
  const r = C.run(D, { exitVotes: (j, need) => (on[j] ? need - 1 : need) });
  return Object.assign(r, { greedCalm: on });
};
