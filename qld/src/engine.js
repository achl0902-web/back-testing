// QLD DCA + volatility-regime backtest engine (shared by grid search and web page)
function prepData(raw, lev, er, spread) {
  lev = lev || 2; er = (er == null ? 0.0095 : er); spread = (spread == null ? 0.005 : spread);
  const n = raw.px.length, day = new Int32Array(n);
  day[0] = raw.d0; for (let i = 1; i < n; i++) day[i] = day[i - 1] + raw.dd[i - 1];
  const lx = new Float64Array(n), ix = new Float64Array(n), rv = new Float64Array(n);
  lx[0] = 1; ix[0] = 1;
  for (let i = 1; i < n; i++) {
    const r = raw.rq[i];
    lx[i] = lx[i - 1] * (1 + lev * r - (lev - 1) * (raw.tb[i] + spread) / 252 - er / 252);
    ix[i] = ix[i - 1] * (1 + r);
  }
  // 20d realized vol of price index, ddof=1, annualized
  const ret = new Float64Array(n);
  for (let i = 1; i < n; i++) ret[i] = raw.px[i] / raw.px[i - 1] - 1;
  for (let i = 0; i < n; i++) {
    if (i < 20) { rv[i] = NaN; continue; }
    let s = 0, s2 = 0;
    for (let k = i - 19; k <= i; k++) { s += ret[k]; }
    const m = s / 20;
    for (let k = i - 19; k <= i; k++) { s2 += (ret[k] - m) ** 2; }
    rv[i] = Math.sqrt(s2 / 19) * Math.sqrt(252);
  }
  // downside semi-volatility (only falling days), x sqrt(2) so it is on the same scale as total vol; and 10-day vol
  const rvDown = new Float64Array(n), rv10 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (i < 20) { rvDown[i] = NaN; } else { let s = 0; for (let k = i - 19; k <= i; k++) if (ret[k] < 0) s += ret[k] * ret[k]; rvDown[i] = Math.sqrt(s / 20 * 252) * Math.SQRT2; }
    if (i < 10) { rv10[i] = NaN; } else { let s = 0, s2 = 0; for (let k = i - 9; k <= i; k++) s += ret[k]; const m = s / 10; for (let k = i - 9; k <= i; k++) s2 += (ret[k] - m) ** 2; rv10[i] = Math.sqrt(s2 / 9) * Math.sqrt(252); }
  }
  const ma = {};
  for (const m of [20, 50, 100, 200]) { const o = new Float64Array(n).fill(NaN); let s = 0;
    for (let i = 0; i < n; i++) { s += raw.px[i]; if (i >= m) s -= raw.px[i - m]; if (i >= m - 1) o[i] = s / m; } ma[m] = o; }
  const year = new Int16Array(n), month = new Int8Array(n), week = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const dt = new Date(day[i] * 86400000);
    year[i] = dt.getUTCFullYear(); month[i] = dt.getUTCMonth() + 1;
    week[i] = Math.floor((day[i] + 5) / 7); // W-FRI weeks (Sat..Fri)
  }
  return { n, day, px: raw.px, tb: raw.tb, fx: raw.fx, lx, ix, rv, vols: { rv20: rv, down20: rvDown, rv10 }, ma, year, month, week };
}

const DEFAULTS = {
  weeklyKRW: 700000, fee: 0.001, fxSpread: 0.001, deduct: 2500000, taxRate: 0.22,
  cashHaircut: 0.001, divTax: 0.154, harvest: true,
  strategy: true, volHi: 0.35, volLo: 0.25, peakRatio: 2 / 3, reentryFrac: 1 / 3,
  parkQQQ: 0, weeklyCheck: false, exitFrac: 1, volHi2: null, volMeasure: 'rv20', maGate: 0,
};

function idxOfDay(D, dayNum, after) {
  let lo = 0, hi = D.n - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (D.day[m] < dayNum) lo = m + 1; else hi = m; }
  if (!after && D.day[lo] > dayNum && lo > 0) lo--;
  return lo;
}

function runBT(D, i0, i1, p, wantLog) {
  p = Object.assign({}, DEFAULTS, p);
  const lots = [[], []]; // 0: leveraged (QLD), 1: QQQ ; each lot [shares, costKRWperShare]
  const px = [D.lx, D.ix];
  let cash = 0, realized = 0, pending = 0, contributed = 0, taxesPaid = 0, fees = 0;
  let regime = 'in', vpk = 0, exits = 0, partial = false;
  const log = [];
  const L = (i, type, msg) => { if (wantLog) log.push({ d: D.day[i], type, msg }); };
  const n1 = i1 - i0 + 1;
  const vals = new Float64Array(n1), contr = new Float64Array(n1), expo = new Float64Array(n1), twr = new Float64Array(n1);
  const flows = [];
  const sharesOf = a => { let s = 0; for (const l of lots[a]) s += l[0]; return s; };
  function sell(a, usd, i) { // FIFO
    const price = px[a][i], f = D.fx[i]; let need = usd / price, got = 0; const q = lots[a];
    while (q.length && need > 1e-12) {
      const take = Math.min(q[0][0], need);
      realized += take * (price * f * (1 - p.fee) - q[0][1]);
      got += take; need -= take; q[0][0] -= take; if (q[0][0] <= 1e-12) q.shift();
    }
    const pr = got * price * (1 - p.fee); fees += got * price * p.fee * f; cash += pr; return pr;
  }
  function buy(a, usd, i) {
    usd = Math.min(usd, cash); if (usd <= 0) return 0;
    cash -= usd; fees += usd * p.fee * D.fx[i];
    lots[a].push([usd * (1 - p.fee) / px[a][i], px[a][i] * D.fx[i]]); return usd;
  }
  function harvestAsset(a, i) {
    const room = p.deduct - realized; if (room <= 0 || !lots[a].length) return 0;
    const gm = px[a][i] * D.fx[i] * (1 - p.fee);
    let cum = 0, cumSh = 0, best = [0, 0];
    for (const [sh, ck] of lots[a]) {
      const g = gm - ck;
      if (g > 0 && cum + sh * g >= room) { best = [room, cumSh + (room - cum) / g]; break; }
      cum += sh * g; cumSh += sh; if (cum > best[0]) best = [cum, cumSh];
    }
    if (best[1] > 0 && best[0] > 0) {
      const before = cash; sell(a, best[1] * px[a][i], i); buy(a, cash - before, i); return best[0];
    }
    return 0;
  }
  const valKRW = i => (sharesOf(0) * D.lx[i] + sharesOf(1) * D.ix[i] + cash) * D.fx[i];
  const fmt = x => { const a = Math.abs(x), s = x < 0 ? '−' : ''; return a >= 1e8 ? s + (a / 1e8).toFixed(2) + '억원' : s + Math.round(a / 1e4).toLocaleString('ko-KR') + '만원'; };
  let prevVal = 0;
  for (let i = i0; i <= i1; i++) {
    const k = i - i0;
    if (i > i0) cash *= 1 + Math.max(D.tb[i] - p.cashHaircut, 0) * (1 - p.divTax) / 252;
    const startVal = (i > i0) ? valKRW(i) : 0;
    // tax payment in June
    if (pending > 0 && D.month[i] >= 6 && (i === i0 || D.month[i - 1] < 6 || D.year[i] !== D.year[i - 1])) {
      const usd = pending / D.fx[i];
      if (cash < usd) { const short = usd - cash; const qv = sharesOf(1) * D.ix[i];
        if (qv > 0) sell(1, Math.min(short + 1e-9, qv), i);
        if (cash < usd) sell(0, usd - cash + 1e-9, i); }
      cash -= usd; taxesPaid += pending; L(i, 'tax', `양도세 납부 ${fmt(pending)}`); pending = 0;
    }
    const j = i > i0 ? i - 1 : i0;
    const check = !p.weeklyCheck || (i > i0 && D.week[i] !== D.week[i - 1]);
    const VS = (D.vols && D.vols[p.volMeasure]) || D.rv;
    if (p.strategy && check && !isNaN(VS[j])) {
      const v = VS[j];
      const MA = p.maGate ? D.ma[p.maGate] : null;
      const below = MA ? D.px[j] < MA[j] : true, above = MA ? D.px[j] > MA[j] : false;
      if (regime === 'in') {
        if (v > p.volHi && below) {
          regime = 'out'; exits++; vpk = p.vpkIncludeExit === false ? 0 : v;
          const ef = Math.min(1, Math.max(0, p.exitFrac)); partial = ef < 0.999;
          const r0 = realized; const pr = sell(0, sharesOf(0) * D.lx[i] * ef, i);
          buy(1, pr * p.parkQQQ, i);
          L(i, 'exit', `변동성 ${(v * 100).toFixed(1)}% > ${(p.volHi * 100).toFixed(0)}%` + (MA ? ` & ${p.maGate}일선 아래` : '') + ` → QLD ${partial ? Math.round(ef * 100) + '%' : '전량'} 매도 ${fmt(pr * D.fx[i])} (실현손익 ${fmt(realized - r0)})` + (p.parkQQQ > 0 ? `, ${Math.round(p.parkQQQ * 100)}% QQQ 대기` : ''));
        }
      } else {
        if (regime === 'out') vpk = Math.max(vpk, v);
        if (regime === 'out' && partial && p.volHi2 != null && v > p.volHi2) {
          partial = false; const r0 = realized; const pr = sell(0, sharesOf(0) * D.lx[i], i); buy(1, pr * p.parkQQQ, i);
          L(i, 'exit', `변동성 ${(v * 100).toFixed(1)}% > ${(p.volHi2 * 100).toFixed(0)}% → 남은 QLD 전량 매도 ${fmt(pr * D.fx[i])} (실현손익 ${fmt(realized - r0)})`);
        }
        if (v < p.volLo || above) {
          const r0 = realized; const q = sharesOf(1) * D.ix[i]; if (q > 0) sell(1, q, i);
          const amt = buy(0, cash, i); regime = 'in'; partial = false;
          L(i, 'reentry', (above && !(v < p.volLo) ? `나스닥100이 ${p.maGate}일선 위로 회복` : `변동성 ${(v * 100).toFixed(1)}% < ${(p.volLo * 100).toFixed(0)}%`) + ` → 전량 QLD 복귀 ${fmt(amt * D.fx[i])}` + (q > 0 ? ` (QQQ 실현손익 ${fmt(realized - r0)})` : ''));
        } else if (regime === 'out' && p.reentryFrac > 0 && v < vpk * p.peakRatio) {
          const q = sharesOf(1) * D.ix[i]; if (q > 0) sell(1, q * p.reentryFrac, i);
          const nonQ = cash; // cash now includes sold QQQ part
          const qPart = q > 0 ? q * p.reentryFrac * (1 - p.fee) : 0;
          const amt = buy(0, (nonQ - qPart) * p.reentryFrac + qPart, i);
          regime = 'staged'; partial = false;
          L(i, 'staged', `변동성 ${(v * 100).toFixed(1)}% (고점 ${(vpk * 100).toFixed(1)}%의 ${Math.round(p.peakRatio * 100)}% 아래) → ${Math.round(p.reentryFrac * 100)}% QLD 복귀 ${fmt(amt * D.fx[i])}`);
        }
      }
    }
    // weekly contribution
    let flowToday = 0;
    if (i === i0 || D.week[i] !== D.week[i - 1]) {
      const usd = p.weeklyKRW / (D.fx[i] * (1 + p.fxSpread));
      cash += usd; contributed += p.weeklyKRW; flowToday = p.weeklyKRW;
      flows.push([D.day[i], -p.weeklyKRW]);
      let toQ = 1, toP = 0;
      if (p.strategy && p.contribAlways) { toQ = 1; toP = 0; }
      else if (p.strategy && regime === 'out') { toQ = partial ? 1 - p.exitFrac : 0; toP = (1 - toQ) * p.parkQQQ; }
      else if (p.strategy && regime === 'staged') { toQ = p.reentryFrac; toP = (1 - p.reentryFrac) * p.parkQQQ; }
      buy(0, usd * toQ, i); if (toP > 0) buy(1, usd * toP, i);
    }
    // year end
    const lastOfYear = (i === D.n - 1) || D.year[i + 1] !== D.year[i];
    if (lastOfYear && i !== i1) {
      if (p.harvest && realized < p.deduct) {
        const r0 = realized; harvestAsset(0, i); harvestAsset(1, i);
        if (realized - r0 > 1) L(i, 'harvest', `연말 비과세 한도 실현 후 재매수: 차익 ${fmt(realized - r0)}`);
      }
      const t = Math.max(realized - p.deduct, 0) * p.taxRate;
      L(i, 'year', `${D.year[i]}년 실현손익 ${fmt(realized)} → 양도세 ${fmt(t)} (다음 해 6월 납부)`);
      pending += t; realized = 0;
    }
    const v = valKRW(i);
    vals[k] = v; contr[k] = contributed;
    expo[k] = v > 0 ? sharesOf(0) * D.lx[i] * D.fx[i] / v : 0;
    if (k === 0) twr[k] = 1; else {
      const base = prevVal + flowToday;
      twr[k] = twr[k - 1] * (base > 0 ? v / base : 1);
    }
    prevVal = v;
  }
  // liquidation
  const i = i1; let gainLiq = 0;
  for (let a = 0; a < 2; a++) for (const [sh, ck] of lots[a]) gainLiq += sh * (px[a][i] * D.fx[i] * (1 - p.fee) - ck);
  const liqTax = Math.max(realized + gainLiq - p.deduct, 0) * p.taxRate + pending;
  const finalAfter = (sharesOf(0) * D.lx[i] * (1 - p.fee) + sharesOf(1) * D.ix[i] * (1 - p.fee) + cash) * D.fx[i] - liqTax;
  flows.push([D.day[i], finalAfter]);
  const irr = xirr(flows);
  let pk = 0, mddV = 0, pkT = 0, mddT = 0, worst = 0;
  for (let k = 0; k < n1; k++) {
    pk = Math.max(pk, vals[k]); if (pk > 0) mddV = Math.min(mddV, vals[k] / pk - 1);
    pkT = Math.max(pkT, twr[k]); mddT = Math.min(mddT, twr[k] / pkT - 1);
    if (contr[k] > 0) worst = Math.min(worst, vals[k] / contr[k] - 1);
  }
  const yrs = (D.day[i1] - D.day[i0]) / 365.25;
  return { regime, vpk, finalAfter, finalPre: vals[n1 - 1], contributed, irr, twrCagr: Math.pow(twr[n1 - 1], 1 / yrs) - 1,
    mddValue: mddV, mddTwr: mddT, worstVsPaid: worst, taxesPaid, liqTax, fees, exits, log,
    vals, contr, expo, twr };
}

function xirr(flows) {
  const t0 = flows[0][0];
  const f = r => { let s = 0; for (const [d, c] of flows) s += c / Math.pow(1 + r, (d - t0) / 365.25); return s; };
  let lo = -0.99, hi = 3;
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

if (typeof module !== 'undefined') module.exports = { prepData, runBT, idxOfDay, DEFAULTS };
