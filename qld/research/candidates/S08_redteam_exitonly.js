// S08 red-team DIAGNOSTIC (not adoptable): turn an extraVote candidate into an "exit-only" fifth axis.
//   The engine's extraVote also counts at re-entry (re-entry needs votes <= 1), so a fifth axis tightens re-entry too.
//   Here the base module's vote only helps exits: extraExit[j] = vote[j] && (champion axes on at j) >= votes - 1.
//   Approximation: inside the 40-day hold window the engine requires champion axes >= strongVotes (3) for an extraExit,
//   whereas a true fifth axis would need champion axes + 1 >= 3. Otherwise identical to a fifth axis on the exit side.
//   params: { base: "candidates/<module>.js", ...base params }
const path = require('path');
const E = require('../../src/engine.js');
module.exports = (D, p, H, L) => {
  const b = require(path.resolve(__dirname, '..', p.base))(D, p, H, L);
  const v = b.extraVote, x = new Uint8Array(D.n), need = (p.votes ?? E.DEFAULTS.votes) - 1;
  for (let j = 0; j < D.n; j++) if (v[j]) { const a = E.axesAt(D, p, j); if (a[0] + a[1] + a[2] + a[3] >= need) x[j] = 1; }
  return { extraExit: x, extraName: (b.extraName || '추가 축') + '(이탈 전용)' };
};
