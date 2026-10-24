// S27 C 조합(가격 자료만, 1960~85 전체 재확인 가능): S14 B 달력(pad=2) + S13 B veto=2(축①을 하방 변동성으로만 세어 이탈 판정;
// 복귀·매크로는 그대로) + S21 C 충격 이탈 기억 복귀(rsiShock=50). exitVotes 합침: 창 안이면 필요 표 +1, 하방만 센 축 수가
// 그 표에 못 미치면 기술 이탈 안 함(99). 값은 과거 최고값 고정.
const L = require('./S09_lib.js'), C = require('./S26_common.js'), C7 = require('./S27_common.js');
module.exports = (D, p) => {
  const win = C.monthWin(D, p.pad ?? 2), shock = C7.shock(D, p.rsiShock ?? 50);
  return L.run(D, {
    exitVotes: (j, need) => { const n = win[j] ? need + 1 : need; return C7.downOnlyCount(D, j) < n ? 99 : n; },
    timeout: { N: 0, ok: (j, st) => shock(st.outSince) && C7.shockOk(D, j) },
  });
};
