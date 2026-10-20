#!/usr/bin/env node
// Tax/FIFO regression tests (T09): the engine's taxes against an independent re-computation on small synthetic paths.
//   node lib/test_tax.js        → prints each case and exits 1 on any mismatch
// Rules being checked (Korean tax on overseas stocks, as modelled):
//   cost basis per lot = KRW paid for the shares at the day's FX rate, buy fee included (필요경비); FX spread is a currency cost, not basis
//   proceeds = price × FX × (1 − fee); FIFO lots; yearly gains netted, 2.5M KRW deduction, 22%, paid next June
//   year-end harvest: realize gains from the oldest lots up to the unused deduction, re-buy at once
const E = require('../../src/engine.js');
const day = s => Math.round(Date.parse(s) / 864e5);
const W = 1e6, FX = 1000, FEE = 0.001, SPR = 0.001, DED = 2.5e6, RATE = 0.22;

// weekly bars (dd = 7, so every bar is a new week and gets a contribution); index path from returns
function data(rets, start) {
  const n = rets.length + 1, raw = { d0: day(start), dd: Array(n - 1).fill(7), px: [100], rq: [0], tb: Array(n).fill(0), fx: Array(n).fill(FX), ms: Array(n).fill(null) };
  for (const r of rets) { raw.px.push(raw.px[raw.px.length - 1] * (1 + r)); raw.rq.push(r); }
  return E.prepData(raw);
}
// independent simulator: DCA or forced exit/re-entry on given bar indices, optional harvest
function indep(D, { exitAt = -1, enterAt = -1, harvest = false }) {
  const lots = []; let cash = 0, realized = 0, pending = 0, paid = 0, out = false;
  const P = i => D.lx[i];
  const buy = (usd, i) => { usd = Math.min(usd, cash); if (usd <= 0) return; /* never buy with money the account does not have */ cash -= usd; const sh = usd * (1 - FEE) / P(i); lots.push([sh, usd * FX / sh]); };
  const sellSh = (shs, i) => { let need = shs, got = 0;
    while (need > 1e-12 && lots.length) { const t = Math.min(lots[0][0], need); realized += t * (P(i) * FX * (1 - FEE) - lots[0][1]); lots[0][0] -= t; need -= t; got += t; if (lots[0][0] <= 1e-12) lots.shift(); }
    cash += got * P(i) * (1 - FEE); };
  for (let i = 0; i < D.n; i++) {
    if (pending > 0 && D.month[i] >= 6 && (i === 0 || D.month[i - 1] < 6 || D.year[i] !== D.year[i - 1])) {
      const usd = pending / FX; if (cash < usd) sellSh((usd - cash + 1e-9) / P(i), i); // short of cash: sell QLD (FIFO) to pay
      cash -= usd; paid += pending; pending = 0; }
    if (i === exitAt) { sellSh(lots.reduce((t, l) => t + l[0], 0), i); out = true; }
    if (i === enterAt) { out = false; buy(cash, i); }
    const usd = W / (FX * (1 + SPR)); cash += usd; if (!out) buy(usd, i);
    const lastOfYear = i === D.n - 1 || D.year[i + 1] !== D.year[i];
    if (lastOfYear && i !== D.n - 1) {
      if (harvest && realized < DED) { // sell oldest lots until the realized gain reaches the room, then re-buy the proceeds
        const room = DED - realized, gm = P(i) * FX * (1 - FEE); let cum = 0, cumSh = 0, best = [0, 0];
        for (const [sh, ck] of lots) { const g = gm - ck; if (g > 0 && cum + sh * g >= room) { best = [room, cumSh + (room - cum) / g]; break; } cum += sh * g; cumSh += sh; if (cum > best[0]) best = [cum, cumSh]; }
        if (best[1] > 0 && best[0] > 0) { const c0 = cash; sellSh(best[1], i); buy(cash - c0, i); }
      }
      pending += Math.max(realized - DED, 0) * RATE; realized = 0;
    }
  }
  const i = D.n - 1; let gain = 0; for (const [sh, ck] of lots) gain += sh * (P(i) * FX * (1 - FEE) - ck);
  return { paid, liqTax: Math.max(realized + gain - DED, 0) * RATE + pending };
}
const base = { weeklyKRW: W, fee: FEE, fxSpread: SPR, deduct: DED, taxRate: RATE, cashHaircut: 0, divTax: 0, initialKRW: 0 };
const cases = [];
// A: one calendar year, rising then falling: lots with gains and losses, liquidation only
{ const D = data([0.05, 0.04, -0.03, 0.06, 0.02, -0.08, 0.05, 0.07, -0.02, 0.03, 0.04, -0.05, 0.06, 0.02, 0.03], '2021-01-04');
  cases.push(['A 한 해 적립·청산 (이익·손실 lot 섞임)', D, base, {}]); }
// B: two years with year-end harvest (partial FIFO sale of the oldest lots), tax paid the next June
{ const r = []; for (let k = 0; k < 80; k++) r.push(k % 9 === 4 ? -0.04 : 0.025);
  const D = data(r, '2021-01-04'); cases.push(['B 2년 · 연말 하베스팅(부분 매도)', D, Object.assign({}, base, { harvest: true }), { harvest: true }]); }
// C: forced exit in year 1 (sell all: mixed lots), re-entry in year 2, June tax payment
{ const r = []; for (let k = 0; k < 80; k++) r.push(k < 22 ? 0.05 : k < 30 ? -0.02 : 0.02);
  const D = data(r, '2021-01-04'), ex = new Uint8Array(D.n), en = new Uint8Array(D.n).fill(1);
  for (let k = 0; k < D.n; k++) { ex[k] = k >= 25 && k < 60 ? 1 : 0; en[k] = ex[k] ? 0 : 1; }
  // engine: signal on bar j executes on bar j+1 → exit on bar 26, re-entry on bar 61
  cases.push(['C 이탈(혼합 lot 전량 매도)·재진입·6월 납부', D, Object.assign({}, base, { harvest: false, exitSig: ex, enterSig: en }), { exitAt: 26, enterAt: 61 }]); }
let fail = 0;
for (const [name, D, p, o] of cases) {
  const R = E.runBT(D, 0, D.n - 1, Object.assign({ strategy: !!p.exitSig, harvest: false }, p), false), I = indep(D, o);
  const ok = Math.abs(R.taxesPaid - I.paid) < 1 && Math.abs(R.liqTax - I.liqTax) < 1;
  if (!ok) fail++;
  console.log(`${ok ? '통과' : '실패'} ${name}: 납부세 엔진 ${Math.round(R.taxesPaid)} / 독립 ${Math.round(I.paid)} · 청산세 엔진 ${Math.round(R.liqTax)} / 독립 ${Math.round(I.liqTax)}`);
}
process.exit(fail ? 1 : 0);
