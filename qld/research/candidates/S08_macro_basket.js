// Candidates 4/5: inflation-tightening basket alarm share (9 indicators, z>1 on own trailing 756 days).
//   mode "exit": extra exit alarm when the share newly crosses th;  mode "vote": fifth axis while share >= th.
const { basketShare } = require('./S08_macro_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 0.6, sh = basketShare(D), a = new Uint8Array(D.n);
  if ((p.mode || 'exit') === 'exit') {
    for (let j = 1; j < D.n; j++) a[j] = sh[j] >= th && !(sh[j - 1] >= th) ? 1 : 0;
    return { extraExit: a, extraName: `긴축 바스켓 ${Math.round(th * 100)}%` };
  }
  for (let j = 0; j < D.n; j++) a[j] = sh[j] >= th ? 1 : 0;
  return { extraVote: a, extraName: '긴축 바스켓' };
};
