// node --test qld/src : the live next-close decision (nextAction on data cut at day t) must equal what the full backtest
// did on day t+1, and mid-week cuts must see the same weekly RSI as the backtest (completed weeks only).
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'research', 'data', 'ndx_ms.json')));
const P = Object.assign({}, E.DEFAULTS, { strategy: true, weeklyKRW: 1e6 });
const cut = (r, t) => { const o = { d0: r.d0, dd: r.dd.slice(0, t) }; for (const k of ['px', 'rq', 'tb', 'fx', 'ms']) o[k] = r[k].slice(0, t + 1); return o; };

test('nextAction matches the backtest around every trade since 2015 and on sampled quiet days', () => {
  const D = E.prepData(raw); let i0 = 0; while (isNaN(D.rv[i0])) i0++;
  const full = E.runBT(D, i0, D.n - 1, P, true);
  const tradeOn = new Map(full.log.filter(e => e.type === 'exit' || e.type === 'reentry').map(e => [e.d, e.type]));
  const t0 = E.idxOfDay(D, Math.round(Date.parse('2015-01-02') / 864e5), true), ts = new Set();
  for (let t = t0; t < D.n - 1; t++) if (tradeOn.has(D.day[t + 1]) || t % 37 === 0) ts.add(t);
  for (const t of ts) {
    const r = cut(raw, t); r.weekDone = D.week[t + 1] !== D.week[t];
    const a = E.nextAction(r, P);
    assert.strictEqual(a.action ? a.action.type : null, tradeOn.get(D.day[t + 1]) || null, `cut ${new Date(D.day[t] * 864e5).toISOString().slice(0, 10)}`);
  }
});

test('mid-week weekly RSI equals the backtest value', () => {
  const D = E.prepData(raw);
  for (let t = D.n - 400; t < D.n - 1; t += 3) {
    const r = cut(raw, t); r.weekDone = D.week[t + 1] !== D.week[t];
    assert.strictEqual(E.prepData(r).rsiw[t], D.rsiw[t]);
  }
});
