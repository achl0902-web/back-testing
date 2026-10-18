// T3: block re-entry while the index is below its 200-day MA and the MA has fallen over k days (k=0: below MA is enough)
const U = require('./S08_tech_util.js');
module.exports = (D, p) => {
  const k = p.k ?? 20, reentryBlock = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) reentryBlock[j] = U.below200(D, j) && U.falling200(D, j, k) ? 1 : 0;
  return { reentryBlock };
};
