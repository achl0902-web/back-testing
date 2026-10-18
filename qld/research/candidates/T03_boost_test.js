// T03 smoke test only (not a candidate): mode 0 = never boost, 1 = always boost, 2 = boost when rv20 < 15% and above the 200-day average
module.exports = (D, p) => { const s = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) s[j] = p.mode === 1 ? 1 : p.mode === 2 ? (D.vols.rv20[j] < 0.15 && D.px[j] > D.ma[200][j] ? 1 : 0) : 0;
  return { boostSig: s }; };
