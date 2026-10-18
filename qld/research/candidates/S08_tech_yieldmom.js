// T2: 10y yield 126-day rise > k (%p) -> extra vote
const U = require('./S08_tech_util.js');
module.exports = (D, p) => {
  const k = p.k ?? 1.0, d = U.chg(U.y10(D), 126);
  const extraVote = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) extraVote[j] = d[j] > k ? 1 : 0;
  return { extraVote, extraName: '금리 급등' };
};
