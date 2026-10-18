// Example signal module (template for researchers).
// Exit when the index closes 4% below its 200-day average; re-enter when it closes back above it.
// Signals must use data up to and including day j only (no look-ahead); the engine trades at the next close.
module.exports = (D, p, H, L) => {
  const band = p.band ?? 0.04, ma = D.ma[200];
  const exitSig = new Uint8Array(D.n), enterSig = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) {
    if (isNaN(ma[j])) continue;
    exitSig[j] = D.px[j] < ma[j] * (1 - band) ? 1 : 0;
    enterSig[j] = D.px[j] > ma[j] ? 1 : 0;
  }
  return { exitSig, enterSig };
};
