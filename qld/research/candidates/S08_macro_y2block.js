// Candidate 2: block re-entry while the 2-year yield has risen more than th (%p) over 63 trading days.
const { M } = require('./S08_macro_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 0.5, c = M.change(M.series(D, 'DGS2', 1), 63);
  const reentryBlock = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) reentryBlock[j] = c[j] > th ? 1 : 0;
  return { reentryBlock };
};
