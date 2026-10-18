// T6: Nasdaq-100 / S&P 500 ratio fell more than X over 63 days -> extra vote (growth/long-duration underperformance)
const U = require('./S08_tech_util.js');
module.exports = (D, p) => {
  const X = p.X ?? 0.05, W = 63;
  const ndx = D.name === 'NDX' ? D.px : U.closeOf(D, 'OHLC_NDX.csv');
  const spx = D.name === 'NDX' ? U.closeOf(D, 'OHLC_SPX.csv') : D.px;
  const extraVote = new Uint8Array(D.n);
  for (let j = W; j < D.n; j++) { const a = ndx[j] / spx[j], b = ndx[j - W] / spx[j - W]; extraVote[j] = isFinite(a / b) && a / b - 1 < -X ? 1 : 0; }
  return { extraVote, extraName: '나스닥 상대약세' };
};
