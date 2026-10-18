// Placebo wrapper: loads params._base signal module and circularly shifts every returned 0/1 array by params._shift days.
// Keeps the signal's on-rate and clustering but breaks its timing relation to the market.
// params._hookShift: for rule "sig" candidates on S09_lib, shift only the candidate's hook calls (champion stays intact).
const path = require('path');
module.exports = (D, p, H, L) => {
  const base = require(path.resolve(__dirname, '..', p._base));
  if (p._hookShift) { // rule "sig" candidates built on candidates/S09_lib.js: shift the hooks, not the champion
    const Lib = require('../candidates/S09_lib.js'); Lib.__used = false; Lib.__shift = p._shift % D.n;
    try { const r = base(D, p, H, L); if (!Lib.__used) throw new Error('S09_lib 미사용 → 훅 이동 플라시보 불가'); return r; }
    finally { Lib.__shift = 0; }
  }
  const r = base(D, p, H, L), k = p._shift % D.n, out = {};
  for (const [key, v] of Object.entries(r)) {
    if (v && typeof v.length === 'number' && v.length === D.n) { const a = new Uint8Array(D.n); for (let i = 0; i < D.n; i++) a[(i + k) % D.n] = v[i]; out[key] = a; }
    else out[key] = v;
  }
  return out;
};
