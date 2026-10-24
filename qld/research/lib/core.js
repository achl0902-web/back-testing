// Scoring core shared by score.js, screen.js and battery.js.
// Baseline (DCA) and champion results are cached on disk per (data, engine, champion, money, costs, window shift),
// so a candidate costs one simulation pass instead of three.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { E, B, load, highLow, sets, episodes, day } = require('./data.js');
const R = path.join(__dirname, '..');
const CACHE = path.join(R, '.cache');

const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const q10 = a => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.1)];
const champion = () => JSON.parse(fs.readFileSync(path.join(R, 'champion.json')));

const sigCache = new Map();
function signalsFor(cfg, D) {
  if (!cfg.signals) return null;
  const key = cfg.signals + '|' + D.name + '|' + JSON.stringify(cfg.params || {});
  if (!sigCache.has(key)) {
    const mod = require(path.resolve(R, cfg.signals));
    sigCache.set(key, mod(D, cfg.params || {}, ...highLow(D)));
  }
  return sigCache.get(key);
}

// returns (D, i0, i1, wantLog) => result
function runner(cfg, base = false) {
  const money = cfg.money || { weekly: 700000 };
  const cm = cfg.costMult || 1;
  if ((cfg.sim || 'engine') === 'engine') {
    return (D, i0, i1, wantLog = false) => {
      const p = Object.assign({ weeklyKRW: money.weekly || 0, initialKRW: money.lump || 0 }, base ? {} : cfg.params || {});
      p.fee = (p.fee ?? E.DEFAULTS.fee) * cm; p.fxSpread = (p.fxSpread ?? E.DEFAULTS.fxSpread) * cm;
      if (base) p.strategy = false; else if (p.strategy === undefined) p.strategy = true;
      if (!base) { const s = signalsFor(cfg, D); if (s) Object.assign(p, s); }
      if (p.inflBlock && !D.ib) D.ib = require('./v2.js').inflBlock(D); // 최종 전략 v2 복귀 금지 배열
      return E.runBT(D, i0, i1, p, wantLog);
    };
  }
  return (D, i0, i1) => {
    const key = 'bsig|' + D.name; if (!sigCache.has(key)) sigCache.set(key, B.signals(D, ...highLow(D)));
    const daily = money.weekly ? money.weekly * 52 / 252 : 0;
    const p = Object.assign({ daily, initial: money.lump || 0 }, base ? { mode: 'dca' } : cfg.params || {});
    const r = B.run(D, sigCache.get(key), i0, i1, p);
    return { irr: r.irr, finalAfter: r.fin, mddValue: r.mddV, worstVsPaid: r.worst, exits: 0, taxesPaid: 0 };
  };
}

// mdd = time-weighted drawdown (cash flows removed) for every risk comparison; mddVal = account-value drawdown (grows with contributions), shown only
const slim = r => ({ irr: r.irr, mdd: r.mddTwr == null ? NaN : r.mddTwr, mddVal: r.mddValue, fin: r.finalAfter, exits: r.exits || 0, tax: r.taxesPaid || 0 });

// raw per-window results for every validation set + episodes + full run since 1999
function evaluate(cfg, opts = {}) {
  const run = runner(cfg, opts.base);
  const out = { sets: {}, episodes: {}, full: null };
  for (const S of sets(cfg.startMonth || 1)) {
    if (opts.only && !opts.only.includes(S.key)) continue;
    out.sets[S.key] = S.w.map(([a, b]) => slim(run(S.D, a, b)));
  }
  if (!opts.noEpisodes) for (const ep of episodes()) out.episodes[ep.key] = slim(run(ep.D, ep.i0, ep.i1));
  if (!opts.noFull) { const { ND } = load(); out.full = slim(run(ND, E.idxOfDay(ND, day('1999-01-04'), true), ND.n - 1)); }
  return out;
}

function fileSig(f) { try { const s = fs.statSync(f); return s.size + ':' + s.mtimeMs; } catch { return 'none'; } }
function cacheKey(kind, cfg) {
  const h = crypto.createHash('sha1');
  h.update(kind + '|v2-mddTwr'); h.update(JSON.stringify({ money: cfg.money || { weekly: 700000 }, costMult: cfg.costMult || 1, startMonth: cfg.startMonth || 1, sim: cfg.sim || 'engine' }));
  for (const f of ['data/ndx_ms.json', 'data/spx_ms.json', '../src/engine.js', 'lib/buyrules.js', 'lib/data.js']) h.update(fileSig(path.join(R, f)));
  if (kind === 'champ') h.update(JSON.stringify(champion()));
  return h.digest('hex').slice(0, 16);
}
function cached(kind, cfg) {
  if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, `${kind}-${cacheKey(kind, cfg)}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f));
  const c = champion();
  const res = kind === 'dca'
    ? evaluate(Object.assign({}, cfg, { signals: null }), { base: true })
    : evaluate(Object.assign({}, c, { money: cfg.money, costMult: cfg.costMult, startMonth: cfg.startMonth }));
  fs.writeFileSync(f, JSON.stringify(res));
  return res;
}

// summary vs DCA and champion; composite = mean over sets of (Δmedian + 0.5·Δworst) vs champion, in %p
const DISCOVERY = ['N10', 'N5'], CONFIRM = ['N10oos', 'S10', 'S5'];
function summarize(cand, cfg) {
  const d = cached('dca', cfg), c = cached('champ', cfg);
  const s = { sets: {}, episodes: {}, overall: {} };
  let wD = 0, wC = 0, n = 0;
  const comp = { disc: [], conf: [] };
  for (const [k, r] of Object.entries(cand.sets)) {
    const dk = d.sets[k], ck = c.sets[k];
    const irr = r.map(x => x.irr);
    const winD = r.filter((x, i) => x.irr > dk[i].irr).length, winC = r.filter((x, i) => x.irr > ck[i].irr + 1e-9).length;
    wD += winD; wC += winC; n += r.length;
    const v = { n: r.length, irrMed: med(irr), irrMin: Math.min(...irr), irrP10: q10(irr),
      dcaMed: med(dk.map(x => x.irr)), dcaMin: Math.min(...dk.map(x => x.irr)),
      champMed: med(ck.map(x => x.irr)), champMin: Math.min(...ck.map(x => x.irr)),
      winVsDca: winD, winVsChamp: winC, mddMed: med(r.map(x => x.mdd)), dcaMddMed: med(dk.map(x => x.mdd)), mddValMed: med(r.map(x => x.mddVal)), dcaMddValMed: med(dk.map(x => x.mddVal)) };
    v.dMed = v.irrMed - v.champMed; v.dMin = v.irrMin - v.champMin;
    s.sets[k] = v;
    (DISCOVERY.includes(k) ? comp.disc : comp.conf).push(100 * (v.dMed + 0.5 * v.dMin));
  }
  for (const [k, r] of Object.entries(cand.episodes)) s.episodes[k] = { vsDca: r.irr - d.episodes[k].irr, vsChamp: r.irr - c.episodes[k].irr };
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  const epWorst = Object.values(s.episodes).length ? Math.min(...Object.values(s.episodes).map(e => e.vsChamp)) * 100 : 0;
  s.overall = { winRateVsDca: wD / n, winRateVsChamp: wC / n, windows: n, exits1999: cand.full ? cand.full.exits : null,
    champExits1999: c.full ? c.full.exits : null, compDisc: avg(comp.disc), compConf: avg(comp.conf), epWorst };
  // screening score: must hold in BOTH discovery and confirmation; penalise an episode > 5%p worse than champion
  s.overall.score = Math.min(s.overall.compDisc, s.overall.compConf) - Math.max(0, -epWorst - 5);
  return s;
}

const pct = (x, d = 1) => (x * 100).toFixed(d);
function printFull(name, s) {
  const L = [`■ ${name}`];
  L.push(`  단순 적립보다 높은 구간 ${pct(s.overall.winRateVsDca, 0)}% · 챔피언보다 높은 구간 ${pct(s.overall.winRateVsChamp, 0)}% · 1999년 이후 이탈 ${s.overall.exits1999}회 (챔피언 ${s.overall.champExits1999})`);
  for (const [k, v] of Object.entries(s.sets))
    L.push(`  ${k.padEnd(7)} IRR 중앙 ${pct(v.irrMed)} (DCA ${pct(v.dcaMed)}, 챔피언 ${pct(v.champMed)}) · 최악 ${pct(v.irrMin)} (DCA ${pct(v.dcaMin)}, 챔피언 ${pct(v.champMin)}) · 하위10% ${pct(v.irrP10)} · MDD중앙(시간가중) ${pct(v.mddMed, 0)} (DCA ${pct(v.dcaMddMed, 0)}) · 평가액 낙폭 ${pct(v.mddValMed, 0)} (DCA ${pct(v.dcaMddValMed, 0)}) · 승 DCA ${v.winVsDca}/${v.n} 챔피언 ${v.winVsChamp}/${v.n}`);
  if (Object.keys(s.episodes).length) L.push('  사례 (DCA 대비 / 챔피언 대비 %p): ' + Object.entries(s.episodes).map(([k, v]) => `${k} ${pct(v.vsDca)}/${pct(v.vsChamp)}`).join(' · '));
  return L.join('\n');
}
// one line: score | Δmed/Δmin per set vs champion | worst episode | exits
function printBrief(name, s) {
  const f = x => (x >= 0 ? '+' : '') + (x * 100).toFixed(1);
  const sets = Object.entries(s.sets).map(([k, v]) => `${k} ${f(v.dMed)}/${f(v.dMin)}`).join(' ');
  return `${s.overall.score.toFixed(2).padStart(6)} | ${sets} | 사례최악 ${s.overall.epWorst.toFixed(1)} | 이탈 ${s.overall.exits1999} | ${name}`;
}

function logTrial(cfg, s, tag) {
  const rec = { t: new Date().toISOString(), step: cfg.step || null, by: cfg.by || tag || null, name: cfg.name || null, sim: cfg.sim || 'engine',
    params: cfg.params || {}, signals: cfg.signals || null, money: cfg.money || { weekly: 700000 }, costMult: cfg.costMult || 1, startMonth: cfg.startMonth || 1,
    score: +s.overall.score.toFixed(3), winVsDca: +s.overall.winRateVsDca.toFixed(3), winVsChamp: +s.overall.winRateVsChamp.toFixed(3),
    sets: Object.fromEntries(Object.entries(s.sets).map(([k, v]) => [k, [+v.irrMed.toFixed(4), +v.irrMin.toFixed(4)]])),
    episodes: Object.fromEntries(Object.entries(s.episodes).map(([k, v]) => [k, +v.vsDca.toFixed(4)])) };
  fs.appendFileSync(path.join(R, 'trials.jsonl'), JSON.stringify(rec) + '\n');
}

module.exports = { E, load, sets, episodes, day, runner, evaluate, cached, summarize, printFull, printBrief, logTrial, med, champion, R, DISCOVERY, CONFIRM };
