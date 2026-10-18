// S10 공통: 자산 자신의 지난 3년(756거래일) 변동성 기준. j일까지만 사용, 주 1회(5거래일) 갱신, 252일 미만이면 NaN(고정 문턱 사용)
const W = 756, MINW = 252, STEP = 5, cache = new WeakMap();
function roll(D, key) {
  let c = cache.get(D); if (!c) { c = {}; cache.set(D, c); }
  if (c[key]) return c[key];
  const x = D.vols[key], n = D.n, med = new Float64Array(n).fill(NaN), mu = new Float64Array(n).fill(NaN), sd = new Float64Array(n).fill(NaN);
  let m = NaN, a = NaN, s = NaN;
  for (let j = 0; j < n; j++) {
    if (j % STEP === 0) {
      const w = []; for (let i = Math.max(0, j - W + 1); i <= j; i++) if (x[i] > 0 && isFinite(x[i])) w.push(x[i]);
      if (w.length >= MINW) { w.sort((p, q) => p - q); m = w[w.length >> 1]; a = w.reduce((p, q) => p + q, 0) / w.length; s = Math.sqrt(w.reduce((p, q) => p + (q - a) * (q - a), 0) / w.length); }
    }
    med[j] = m; mu[j] = a; sd[j] = s;
  }
  return (c[key] = { med, mu, sd });
}
// 챔피언 4축을 문턱만 바꿔 센다. th(j) -> {dn, up, crash, zdn?, zup?}
function axesWith(D, j, t) {
  const v = D.vols; let n = 0;
  if (t.vol ? t.vol(j) : (v.down20[j] > t.dn || v.up20[j] > t.up)) n++;
  if (D.r10[j] < t.crash) n++;
  if (D.rsiw[j] < 45) n++;
  if (D.v60[j] > 0 && v.rv10[j] / D.v60[j] > 1.6) n++;
  return n;
}
module.exports = { roll, axesWith };
