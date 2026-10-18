// Placebo wrapper: loads params._base signal module and circularly shifts every returned 0/1 array by params._shift days.
// Keeps the signal's on-rate and clustering but breaks its timing relation to the market.
const path = require('path');
module.exports = (D, p, H, L) => {
  const base = require(path.resolve(__dirname, '..', p._base));
  const r = base(D, p, H, L), k = p._shift % D.n, out = {};
  for (const [key, v] of Object.entries(r)) {
    if (v && typeof v.length === 'number' && v.length === D.n) { const a = new Uint8Array(D.n); for (let i = 0; i < D.n; i++) a[(i + k) % D.n] = v[i]; out[key] = a; }
    else out[key] = v;
  }
  return out;
};
