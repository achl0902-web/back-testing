// Candidate 3: headline CPI YoY (monthly, 45-day publication lag) >= th (%) as a fifth vote axis.
const { monthlyYoY } = require('./S08_macro_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 5, y = monthlyYoY(D, 'CPIAUCSL', 45);
  const extraVote = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) extraVote[j] = y[j] >= th ? 1 : 0;
  return { extraVote, extraName: '고물가' };
};
