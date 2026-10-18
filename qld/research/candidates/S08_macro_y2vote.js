// Candidate 1: 2-year Treasury yield 126-day rise > th (%p) as a fifth vote axis (tightening regime).
const { M } = require('./S08_macro_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 1.0, c = M.change(M.series(D, 'DGS2', 1), 126);
  const extraVote = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) extraVote[j] = c[j] > th ? 1 : 0;
  return { extraVote, extraName: '2년 금리 급등' };
};
