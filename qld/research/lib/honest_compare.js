const C = require('./core.js');
const money = { weekly: 1e6 }, pc = x => (x * 100).toFixed(1);
const S = [['단순 적립', { params: { strategy: false } }, true], ['현 챔피언', { params: { strategy: true } }],
  ['사후 지수 뺀 매크로(V2)', { signals: 'candidates/T09_macro.js', params: { strategy: true, useMacro: false, variant: 'V2' } }],
  ['실시간 매크로 8개(R8, 50%)', { signals: 'candidates/S20_A.js', params: { strategy: true, useMacro: false, th: 0.5 } }],
  ['기술 4축만', { params: { strategy: true, useMacro: false } }]];
const res = S.map(([n, c, base]) => [n, C.evaluate(Object.assign({ name: n, money }, c), { base })]);
for (const k of Object.keys(res[0][1].sets)) console.log(k.padEnd(6) + res.map(([n, r]) => { const irr = r.sets[k].map(x => x.irr); return `${n} ${pc(C.med(irr))}/${pc(Math.min(...irr))}/MDD${pc(C.med(r.sets[k].map(x => x.mdd)))}`; }).join(' · '));
console.log('사례 IRR: ' + Object.keys(res[0][1].episodes).map(e => e + ' ' + res.map(([, r]) => pc(r.episodes[e].irr)).join('/')).join(' · '));
console.log('1999~: ' + res.map(([n, r]) => `${n} ${pc(r.full.irr)}% MDD ${pc(r.full.mdd)} 이탈 ${r.full.exits}`).join(' | '));
