// node --test qld/src/engine.test.js : a mid-week live build must see the same weekly RSI as the backtest on that day
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'research', 'data', 'ndx_ms.json')));

test('weekly RSI on data cut at day t equals the backtest value', () => {
  const D = E.prepData(raw);
  for (let t = D.n - 400; t < D.n - 1; t++) {
    const r = { d0: raw.d0, dd: raw.dd.slice(0, t), weekDone: D.week[t + 1] !== D.week[t] };
    for (const k of ['px', 'rq', 'tb', 'fx', 'ms']) r[k] = raw[k].slice(0, t + 1);
    assert.strictEqual(E.prepData(r).rsiw[t], D.rsiw[t], `t=${t}`);
  }
});
