// V2 C: macro onset counts only when the share was below th for the previous K trading days (debounce flicker around 50%).
// Use with params { useMacro: false, K }; replaces the champion's onset.
module.exports = (D, p) => {
  const th = 0.5, K = p.K, ex = new Uint8Array(D.n);
  let below = 0; // consecutive days below th, up to yesterday
  for (let j = 1; j < D.n; j++) {
    below = D.ms[j - 1] >= th || isNaN(D.ms[j - 1]) ? 0 : below + 1;
    ex[j] = D.ms[j] >= th && below >= K ? 1 : 0;
  }
  return { extraExit: ex };
};
