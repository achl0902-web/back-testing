// Candidate 6: 10-year yield 126-day rise > th (%p) as a fifth vote axis. series "DGS10" (nominal, 1962+) or
// "DFII10" (real, 2003+ only; diagnostic, not adoptable on its own).
const { M } = require('./S08_macro_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 1.0, c = M.change(M.series(D, p.series || 'DGS10', 1), 126);
  const extraVote = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) extraVote[j] = c[j] > th ? 1 : 0;
  return { extraVote, extraName: '장기금리 급등' };
};
