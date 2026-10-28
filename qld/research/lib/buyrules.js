// Buy-rule strategy vs daily DCA. Same daily KRW inflow; strategy may hold cash in SGOV.
const E = require('../../src/engine.js');
const DEF = E.DEFAULTS;
const { xirr } = E;  // money-weighted return: same function as the engine
// signals on the leveraged price (QLD); H/L optional arrays (same length) else close-only
function signals(D, H, L) {
  const c = D.lx, n = D.n, rsi = new Float64Array(n).fill(NaN), ath = new Uint8Array(n), sk = new Float64Array(n).fill(NaN), sd = new Float64Array(n).fill(NaN);
  let ag = 0, al = 0, mx = 0;
  for (let i = 1; i < n; i++) { const ch = c[i] - c[i - 1];
    if (i <= 14) { ag += Math.max(ch, 0) / 14; al += Math.max(-ch, 0) / 14; if (i === 14) rsi[i] = 100 - 100 / (1 + ag / al); }
    else { ag = (ag * 13 + Math.max(ch, 0)) / 14; al = (al * 13 + Math.max(-ch, 0)) / 14; rsi[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } }
  for (let i = 0; i < n; i++) { if (c[i] >= mx * 0.9999) ath[i] = 1; mx = Math.max(mx, c[i]); }
  const fk = new Float64Array(n).fill(NaN);
  for (let i = 13; i < n; i++) { let hh = -1e18, ll = 1e18; for (let k = i - 13; k <= i; k++) { hh = Math.max(hh, H ? H[k] : c[k]); ll = Math.min(ll, L ? L[k] : c[k]); } fk[i] = hh > ll ? 100 * (c[i] - ll) / (hh - ll) : 50; }
  for (let i = 15; i < n; i++) sk[i] = (fk[i] + fk[i - 1] + fk[i - 2]) / 3;
  for (let i = 17; i < n; i++) sd[i] = (sk[i] + sk[i - 1] + sk[i - 2]) / 3;
  const h52 = new Uint8Array(n); for (let i = 0; i < n; i++) { let m = 0; for (let k = Math.max(0, i - 251); k <= i; k++) m = Math.max(m, c[k]); h52[i] = c[i] >= m * 0.9999 ? 1 : 0; }
  const mx52 = new Float64Array(n); for (let i = 0; i < n; i++) { let m = 0; for (let k = Math.max(0, i - 251); k <= i; k++) m = Math.max(m, c[k]); mx52[i] = m; }
  return { rsi, ath, h52, sk, sd, mx52 };
}
function run(D, S, i0, i1, o) {
  o = Object.assign({ daily: 700000 * 52 / 252, initial: 0, mode: 'dca', f50: 0.25, fSto: 1, hiOK: false, rsiHi: 70, rsiLo: 50, stoLo: 20, trim: 0, stoLine: 'k', harvest: true }, o);
  const p = DEF; const lots = []; let cash = 0, realized = 0, pending = 0, contributed = 0, cashSum = 0, cashMax = 0, nb = 0;
  const flows = []; let pk = 0, mddV = 0, worst = 0;
  const sh = () => lots.reduce((s, l) => s + l[0], 0);
  const sell = (usd, i) => { const pr = D.lx[i], f = D.fx[i]; let need = usd / pr, got = 0;
    while (lots.length && need > 1e-12) { const t = Math.min(lots[0][0], need); realized += t * (pr * f * (1 - p.fee) - lots[0][1]); got += t; need -= t; lots[0][0] -= t; if (lots[0][0] <= 1e-12) lots.shift(); }
    cash += got * pr * (1 - p.fee); };
  const buy = (usd, i) => { usd = Math.min(usd, cash); if (usd <= 1e-9) return; cash -= usd; lots.push([usd * (1 - p.fee) / D.lx[i], D.lx[i] * D.fx[i]]); };
  for (let i = i0; i <= i1; i++) {
    if (i > i0) cash *= 1 + Math.max(D.tb[i] - p.cashHaircut, 0) * (1 - p.divTax) / 252;
    if (pending > 0 && D.month[i] >= 6 && (D.month[i - 1] < 6 || D.year[i] !== D.year[i - 1])) { const usd = pending / D.fx[i]; if (cash < usd) sell(usd - cash + 1e-9, i); cash -= usd; pending = 0; }
    const inK = o.daily + (i === i0 ? o.initial : 0);
    cash += inK / (D.fx[i] * (1 + p.fxSpread)); contributed += inK; flows.push([D.day[i], -inK]);
    const today = (o.daily||0) / (D.fx[i] * (1 + p.fxSpread)) + (i === i0 ? o.initial / (D.fx[i] * (1 + p.fxSpread)) : 0);
    if (o.mode === 'shannon') {
      const w = o.w, rb = o.reb, v = sh() * D.lx[i] + cash, cur = v > 0 ? sh() * D.lx[i] / v : 0;
      const due = rb === 'daily' ? true : rb === 'weekly' ? D.week[i] !== D.week[i - 1] : rb === 'monthly' ? D.month[i] !== D.month[i - 1]
        : rb === 'quarterly' ? (D.month[i] !== D.month[i - 1] && (D.month[i] - 1) % 3 === 0) : rb === 'yearly' ? D.year[i] !== D.year[i - 1] : false;
      const band = typeof rb === 'number' && Math.abs(cur - w) > rb;
      if (i === i0 || due || band) { const tgt = w * v, q = sh() * D.lx[i]; if (q > tgt) { const s0 = sh(); sell(q - tgt, i); o._sells = (o._sells || 0) + 1; } else buy(Math.min(cash, tgt - q), i); }
      else buy(Math.min(cash, w * (inK / (D.fx[i] * (1 + p.fxSpread)))), i);
    }
    else if (o.mode === 'spread') { if (i - i0 < o.spreadDays) buy(cash / (o.spreadDays - (i - i0)), i); }
    else if (o.mode === 'dca') buy(cash, i);
    else if (o.mode === 'lump') { const j = i - 1, r = S.rsi[j], st = S.sk[j], L = o.lump;
      const go = L === 'monthly' ? (D.month[i] !== D.month[i - 1]) : L === 'rsi50' ? r < 50 : L === 'rsi40' ? r < 40 : L === 'rsi30' ? r < 30
        : L === 'sto20' ? st <= 20 : L === 'sto10' ? st <= 10 : L === 'rsi50sto20' ? (r < 50 && st <= 20) : L === 'rsi40sto20' ? (r < 40 && st <= 20)
        : L === 'dd10' ? D.lx[j] <= S.mx52[j] * 0.9 : L === 'dd20' ? D.lx[j] <= S.mx52[j] * 0.8 : false;
      if (go) buy(cash, i); }
    else { const j = i - 1, r = S.rsi[j], st = o.stoLine === 'd' ? S.sd[j] : S.sk[j];
      if (st <= o.stoLo) buy(cash * o.fSto, i);                      // 4. slow stochastic <= 20: add
      else if (r < o.rsiLo) buy(Math.min(cash, today + (cash - today) * o.f50), i); // 3. RSI < 50: today's amount + part of the pile
      else if (r > o.rsiHi) { if (o.trim > 0) sell(sh() * D.lx[i] * o.trim, i); } // 2. RSI > 70: hold off (optionally trim)
      else if ((o.hi === '52w' ? S.h52[j] : S.ath[j]) && !o.hiOK) { }                                  // 1. new high: do not buy
      else buy(today, i);                                                // otherwise: normal daily buy
    }
    const last = (i === D.n - 1) || D.year[i + 1] !== D.year[i];
    if (last && i !== i1) {
      if (o.harvest && realized < p.deduct && lots.length) { const room = p.deduct - realized, gm = D.lx[i] * D.fx[i] * (1 - p.fee); let cum = 0, cs = 0, best = [0, 0];
        for (const [s, ck] of lots) { const g = gm - ck; if (g > 0 && cum + s * g >= room) { best = [room, cs + (room - cum) / g]; break; } cum += s * g; cs += s; if (cum > best[0]) best = [cum, cs]; }
        if (best[0] > 0 && best[1] > 0) { const b0 = cash; sell(best[1] * D.lx[i], i); buy(cash - b0, i); } }
      pending += Math.max(realized - p.deduct, 0) * p.taxRate; realized = 0;
    }
    const v = (sh() * D.lx[i] + cash) * D.fx[i]; cashSum += cash * D.fx[i] / v; nb++; cashMax = Math.max(cashMax, cash * D.fx[i] / v);
    pk = Math.max(pk, v); mddV = Math.min(mddV, v / pk - 1); worst = Math.min(worst, v / contributed - 1);
  }
  let gl = 0; for (const [s, ck] of lots) gl += s * (D.lx[i1] * D.fx[i1] * (1 - p.fee) - ck);
  const fin = (sh() * D.lx[i1] * (1 - p.fee) + cash) * D.fx[i1] - (Math.max(realized + gl - p.deduct, 0) * p.taxRate + pending);
  flows.push([D.day[i1], fin]);
  return { fin, irr: xirr(flows), mddV, worst, contributed, cashAvg: cashSum / nb, cashMax, cashEnd: cash * D.fx[i1] / ((sh() * D.lx[i1] + cash) * D.fx[i1]) };
}
module.exports = { signals, run };
