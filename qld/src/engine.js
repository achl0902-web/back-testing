// QLD DCA + volatility-regime backtest engine (shared by grid search and web page)
const ER3 = 0.0084; // TQQQ expense ratio
function prepData(raw, lev, er, spread) {
  lev = lev || 2; er = (er == null ? 0.0095 : er); spread = (spread == null ? 0.005 : spread);
  const n = raw.px.length, day = new Int32Array(n);
  day[0] = raw.d0; for (let i = 1; i < n; i++) day[i] = day[i - 1] + raw.dd[i - 1];
  const lx = new Float64Array(n), ix = new Float64Array(n), rv = new Float64Array(n);
  const lx3 = new Float64Array(n), mu = new Float64Array(n).fill(NaN);
  lx[0] = 1; ix[0] = 1; lx3[0] = 1;
  for (let i = 1; i < n; i++) {
    const r = raw.rq[i];
    lx[i] = lx[i - 1] * (1 + lev * r - (lev - 1) * (raw.tb[i] + spread) / 252 - er / 252);
    ix[i] = ix[i - 1] * (1 + r);
    lx3[i] = lx3[i - 1] * (1 + 3 * r - 2 * (raw.tb[i] + spread) / 252 - ER3 / 252);
  }
  // expanding mean of the index's daily excess return over T-bills (only past data), annualized; needs 2 years
  { let s = 0; for (let i = 1; i < n; i++) { s += raw.px[i] / raw.px[i - 1] - 1 - raw.tb[i] / 252; if (i >= 500) mu[i] = s / i * 252; } }
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
  // final-strategy inputs: upside semivol, 60d vol, 10d return, weekly RSI(14)
  const up20 = new Float64Array(n).fill(NaN), v60 = new Float64Array(n).fill(NaN), r10 = new Float64Array(n).fill(NaN);
  for (let i = 61; i < n; i++) {
    let s = 0; for (let k = i - 19; k <= i; k++) if (ret[k] > 0) s += ret[k] * ret[k];
    up20[i] = Math.sqrt(s / 20 * 252) * Math.SQRT2;
    let m = 0; for (let k = i - 59; k <= i; k++) m += ret[k]; m /= 60; let s2 = 0; for (let k = i - 59; k <= i; k++) s2 += (ret[k] - m) ** 2;
    v60[i] = Math.sqrt(s2 / 59) * Math.sqrt(252);
    r10[i] = raw.px[i] / raw.px[i - 10] - 1;
  }
  const wkEnd = [];
  { const wk = new Int32Array(n); for (let i = 0; i < n; i++) wk[i] = Math.floor((day[i] + 5) / 7);
    for (let i = 0; i < n; i++) if (i === n - 1 || wk[i + 1] !== wk[i]) wkEnd.push(i); }
  const wpx = wkEnd.map(i => raw.px[i]), wr = new Float64Array(wpx.length).fill(NaN);
  { let u = 0, d = 0; for (let k = 1; k < wpx.length; k++) { const c = wpx[k] - wpx[k - 1], a = Math.max(c, 0), b = Math.max(-c, 0);
      if (k === 1) { u = a; d = b; } else { u += (a - u) / 14; d += (b - d) / 14; } if (k >= 14) wr[k] = d === 0 ? 100 : 100 - 100 / (1 + u / d); } }
  const rsiw = new Float64Array(n).fill(NaN);
  { let k = -1; for (let i = 0; i < n; i++) { while (k + 1 < wkEnd.length && wkEnd[k + 1] <= i) k++; if (k >= 0) rsiw[i] = wr[k]; } }
  const ms = new Float64Array(n).fill(NaN); if (raw.ms) for (let i = 0; i < n; i++) if (raw.ms[i] != null) ms[i] = raw.ms[i];
  const ma = {};
  for (const m of [20, 50, 100, 200]) { const o = new Float64Array(n).fill(NaN); let s = 0;
    for (let i = 0; i < n; i++) { s += raw.px[i]; if (i >= m) s -= raw.px[i - m]; if (i >= m - 1) o[i] = s / m; } ma[m] = o; }
  const year = new Int16Array(n), month = new Int8Array(n), week = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const dt = new Date(day[i] * 86400000);
    year[i] = dt.getUTCFullYear(); month[i] = dt.getUTCMonth() + 1;
    week[i] = Math.floor((day[i] + 5) / 7); // W-FRI weeks (Sat..Fri)
  }
  return { n, day, px: raw.px, tb: raw.tb, fx: raw.fx, vix: raw.vix || null, lx, ix, lx3, mu, rv, vols: { rv20: rv, down20: rvDown, rv10, up20 }, v60, r10, rsiw, ms, ma, year, month, week };
}

const DEFAULTS = {
  weeklyKRW: 700000, fee: 0.001, fxSpread: 0.001, deduct: 2500000, taxRate: 0.22,
  cashHaircut: 0.001, divTax: 0.154, harvest: true,
  strategy: true, volHi: 0.35, volLo: 0.25, peakRatio: 2 / 3, reentryFrac: 1 / 3,
  rule: 'final', dnHi: 0.30, upHi: 0.35, crash: -0.08, rsiW: 45, expand: 1.6, votes: 2, strongVotes: 3, hold: 40,
  reMaxVotes: 1, useMacro: true, macroTh: 0.5,
  parkQQQ: 0, weeklyCheck: false, slowMA: 0, slowBand: 0,
  // volatility-sized exposure with TQQQ/QQQ/SGOV. Default: step table on 20-day vol (<25% 2.5x, <35% 2x, <45% 1x, else 0x);
  // 'kelly' sizing: kellyFrac * mu/sigma^2. Rebalance on check days when |target - holding| > band
  maxLev: 2.5, kellyFrac: 1, band: 0.5, check: 'd', sizing: 'steps', hyst: 0.03, anchorVol: 0.2, anchorLev: 2, steps: [[0.25, 2.5], [0.35, 2], [0.45, 1], [Infinity, 0]], capRule: 'none', capLev: 1.5, exitFrac: 1, volHi2: null, volMeasure: 'rv20', maGate: 0, maMode: 'and', maBand: 0,
};

function axesAt(D, p, j) {
  if (!p.__merged) p = Object.assign({}, DEFAULTS, p);
  if (j < 61) return [0, 0, 0, 0];
  const v = (D.vols.down20[j] > p.dnHi || D.vols.up20[j] > p.upHi) ? 1 : 0;
  const c = D.r10[j] < p.crash ? 1 : 0;
  const t = D.rsiw[j] < p.rsiW ? 1 : 0;
  const x = D.vols.rv10[j] / D.v60[j] > p.expand ? 1 : 0;
  return [v, c, t, x];
}
function macroOnset(D, p, j) {
  return !!p.useMacro && j > 0 && !isNaN(D.ms[j]) && D.ms[j] >= p.macroTh && !(D.ms[j - 1] >= p.macroTh);
}
function reentryOK(D, p, cnt, j) { return cnt <= p.reMaxVotes && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j]; }

function kellyTarget(D, p, j) {
  if (!p.__merged) p = Object.assign({}, DEFAULTS, p);
  const s = D.rv[j] + (p._sAdd || 0), m = D.mu[j];
  if (isNaN(s) || s <= 0 || (isNaN(m) && (!p.sizing || p.sizing === 'kelly'))) return 2;
  let e;
  if (p.sizing === 'steps') { e = p.steps[p.steps.length - 1][1]; for (const [lim, lev] of p.steps) if (s < lim) { e = lev; break; } }
  else if (p.sizing === 'invvol') e = p.anchorLev * p.anchorVol / s;
  else if (p.sizing === 'invvar') e = p.anchorLev * (p.anchorVol / s) ** 2;
  else e = p.kellyFrac * m / (s * s);
  e = Math.min(p.maxLev, Math.max(0, e));
  if (p.capRule === 'macro' && !isNaN(D.ms[j]) && D.ms[j] >= 0.5) e = Math.min(e, p.capLev);
  if (p.capRule === 'ma200' && !isNaN(D.ma[200][j]) && D.px[j] < D.ma[200][j]) e = Math.min(e, p.capLev);
  return e;
}
// target given the last executed target: cut as soon as vol crosses a boundary, raise only when vol is `hyst` below it
function targetFrom(D, p, j, last) {
  if (!p.__merged) p = Object.assign({}, DEFAULTS, p);
  let e = Math.max(0, Math.min(p.maxLev, kellyTarget(D, p, j)));
  if (p.hyst > 0 && e > last) e = Math.max(last, Math.min(e, kellyTarget(D, Object.assign({}, p, { _sAdd: p.hyst }), j)));
  return e;
}
// exposure -> weights of [TQQQ, QQQ, SGOV]
function mixOf(e) { const a = Math.max(e - 1, 0) / 2, b = e >= 1 ? 1 - a : e; return [a, b, 1 - a - b]; }

function idxOfDay(D, dayNum, after) {
  let lo = 0, hi = D.n - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (D.day[m] < dayNum) lo = m + 1; else hi = m; }
  if (!after && D.day[lo] > dayNum && lo > 0) lo--;
  return lo;
}

function runBT(D, i0, i1, p, wantLog) {
  p = Object.assign({}, DEFAULTS, p, { __merged: true });
  const lots = [[], []]; // 0: leveraged (QLD), 1: QQQ ; each lot [shares, costKRWperShare]
  const KELLY = p.strategy && p.rule === 'kelly';
  const LX = KELLY ? D.lx3 : D.lx, LV = KELLY ? 3 : 2;
  const px = [LX, D.ix];
  let cash = 0, realized = 0, pending = 0, contributed = 0, taxesPaid = 0, fees = 0;
  let tgtE = 2, nReb = 0, lastTgt = NaN, regime = 'in', vpk = 0, exits = 0, partial = false, lastEntry = -1e9, outSince = 0, fKeep = 1, halfPending = false, slow = false;
  const log = [];
  const L = (i, type, msg) => { if (wantLog) log.push({ d: D.day[i], type, msg }); };
  const n1 = i1 - i0 + 1;
  const vals = new Float64Array(n1), contr = new Float64Array(n1), expo = new Float64Array(n1), twr = new Float64Array(n1), expoTot = new Float64Array(n1), tgtS = new Float64Array(n1).fill(NaN);
  const flows = [];
  const shTot = [0, 0]; // running share totals (avoids re-summing every lot each day)
  const sharesOf = a => shTot[a];
  function sell(a, usd, i) { // FIFO
    const price = px[a][i], f = D.fx[i]; let need = usd / price, got = 0; const q = lots[a];
    while (q.length && need > 1e-12) {
      const take = Math.min(q[0][0], need);
      realized += take * (price * f * (1 - p.fee) - q[0][1]);
      got += take; need -= take; q[0][0] -= take; shTot[a] -= take; if (q[0][0] <= 1e-12) { shTot[a] -= q[0][0]; q.shift(); }
    }
    const pr = got * price * (1 - p.fee); fees += got * price * p.fee * f; cash += pr; return pr;
  }
  function buy(a, usd, i) {
    usd = Math.min(usd, cash); if (usd <= 0) return 0;
    cash -= usd; fees += usd * p.fee * D.fx[i];
    const sh = usd * (1 - p.fee) / px[a][i]; lots[a].push([sh, px[a][i] * D.fx[i]]); shTot[a] += sh; return usd;
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
  const valKRW = i => (sharesOf(0) * LX[i] + sharesOf(1) * D.ix[i] + cash) * D.fx[i];
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
    if (KELLY) {
      // on each check day (signal from the previous close), rebalance only when the holding is off target by more than the band
      const chk = i === i0 || p.check === 'd' || (p.check === 'w' ? D.week[i] !== D.week[i - 1]
        : D.month[i] !== D.month[i - 1] && (D.month[i] - 1) % (+String(p.check).slice(1) || 1) === 0);
      if (chk) {
        const e = i > i0 ? targetFrom(D, p, j, tgtE) : Math.max(0, Math.min(p.maxLev, kellyTarget(D, p, j)));
        lastTgt = e;
        const V = sharesOf(0) * LX[i] + sharesOf(1) * D.ix[i] + cash;
        const cur = V > 0 ? (LV * sharesOf(0) * LX[i] + sharesOf(1) * D.ix[i]) / V : 0;
        if (V > 0 && (i === i0 || Math.abs(e - cur) > p.band)) {
          tgtE = e; const [wa, wb] = mixOf(e); const r0 = realized;
          const qv = sharesOf(0) * LX[i], uv = sharesOf(1) * D.ix[i];
          if (qv > wa * V + 1e-9) { sell(0, qv - wa * V, i); exits++; }
          if (uv > wb * V + 1e-9) sell(1, uv - wb * V, i);
          const qv2 = sharesOf(0) * LX[i], uv2 = sharesOf(1) * D.ix[i];
          if (wa * V > qv2) buy(0, wa * V - qv2, i);
          if (wb * V > uv2) buy(1, wb * V - uv2, i);
          if (i > i0) { nReb++; const [x, y, z] = mixOf(e);
            L(i, e < cur ? 'down' : 'up', `노출 ${cur.toFixed(2)}배 → ${e.toFixed(2)}배 (20일 변동성 ${(D.rv[j] * 100).toFixed(0)}%${p.sizing === 'kelly' ? `, 기대수익 ${(D.mu[j] * 100).toFixed(1)}%` : ''}) · TQQQ ${Math.round(x * 100)}% · QQQ ${Math.round(y * 100)}% · SGOV ${Math.round(z * 100)}%` + (Math.abs(realized - r0) > 1 ? ` (실현손익 ${fmt(realized - r0)})` : '')); }
        }
      }
    } else if (p.strategy && check && p.rule === 'final' && !p.exitSig) {
      // research hooks (optional arrays by signal day): extraVote adds a fifth axis, extraExit is an extra exit alarm,
      // reentryBlock vetoes re-entry while set
      // (extraVoteExit counts toward the exit vote only; extraVote also tightens re-entry, which needs votes <= reMaxVotes)
      const xv = p.extraVote && p.extraVote[j] ? 1 : 0, xOn = !!(p.extraExit && p.extraExit[j]);
      const xe = p.extraVoteExit && p.extraVoteExit[j] ? 1 : 0;
      const ax = axesAt(D, p, j), c = ax[0] + ax[1] + ax[2] + ax[3] + xv, mOn = macroOnset(D, p, j) || xOn;
      // action-type research params (defaults keep the champion unchanged):
      //   fExit1  share of QLD sold on an ordinary exit (rest sold when votes reach strongVotes or the macro alarm fires)
      //   fCore   share of QLD never sold on exits (core holding)      contribOut  share of contributions still bought while out
      //   ddRe    re-enter when the index is this far below its 252-day high and above its 20-day average (contrarian)
      //   maxOut  re-enter after this many trading days out if above the 20-day average
      const strong = c + xe >= p.strongVotes || mOn, fCore = p.fCore || 0;
      // in-market leverage choice (S11): while 'slow', the in-market holding is QQQ (1x) instead of QLD.
      //   slowMA/slowBand: slow when the index closes below its slowMA-day average by slowBand, back to QLD above it by slowBand
      //   slowSig: research hook (0/1 by signal day) that sets the slow state directly. Defaults keep the champion unchanged.
      const SLOW = !!(p.slowSig || p.slowMA > 0);
      if (p.slowSig) slow = !!p.slowSig[j];
      else if (p.slowMA > 0) { const m = D.ma[p.slowMA][j]; if (!slow && D.px[j] < m * (1 - p.slowBand)) slow = true; else if (slow && D.px[j] > m * (1 + p.slowBand)) slow = false; }
      const inA = SLOW && slow ? 1 : 0;
      if (regime === 'in' && halfPending && reentryOK(D, p, c, j) && !(p.reentryBlock && p.reentryBlock[j])) {
        const amt = buy(inA, cash, i); halfPending = false;
        L(i, 'reentry', `켜진 축 ${c}개 · 20일선 위 · 단기 변동성 진정 → 나머지 QLD ${fmt(amt * D.fx[i])}`);
      }
      if (regime === 'in') {
        if ((c + xe >= p.votes || mOn) && (i - lastEntry >= p.hold || c + xe >= p.strongVotes)) {
          const keep = fCore + (1 - fCore) * (strong ? 0 : 1 - (p.fExit1 ?? 1));
          if (SLOW && sharesOf(1) > 0) sell(1, sharesOf(1) * D.ix[i], i);
          regime = 'out'; exits++; outSince = i; fKeep = keep; halfPending = false; const r0 = realized; const pr = sell(0, sharesOf(0) * LX[i] * (1 - keep), i); buy(1, pr * p.parkQQQ, i);
          const nm = ['변동성', '급락', '추세', '급팽창'].filter((_, k) => ax[k]); if (xv) nm.push(p.extraName || '추가 축');
          const why = (c >= p.votes ? `기술 ${c}축(${nm.join('·')})` : '') + (mOn ? `${c >= p.votes ? ' + ' : ''}${xOn && !macroOnset(D, p, j) ? (p.extraName || '추가 경보') : `매크로 경보 ${Math.round(D.ms[j] * 100)}%`}` : '');
          L(i, 'exit', `${why} → QLD ${keep > 0 ? Math.round((1 - keep) * 100) + '%' : '전량'} 매도 ${fmt(pr * D.fx[i])} (실현손익 ${fmt(realized - r0)})`);
        }
      } else {
        if (strong && fKeep > fCore + 1e-9) { // escalate a partial exit
          const r0 = realized; const pr = sell(0, sharesOf(0) * LX[i] * (1 - fCore / fKeep), i); buy(1, pr * p.parkQQQ, i); fKeep = fCore;
          L(i, 'exit', `강한 신호 → 남은 QLD ${fCore > 0 ? '(코어 제외) ' : ''}매도 ${fmt(pr * D.fx[i])} (실현손익 ${fmt(realized - r0)})`);
        }
        const above20 = D.px[j] > D.ma[20][j];
        let why = null;
        if (reentryOK(D, p, c, j) && !(p.reentryBlock && p.reentryBlock[j])) why = `켜진 축 ${c}개 · 20일선 위 · 단기 변동성 진정`;
        else if (p.ddRe > 0 && above20) { if (!D._mx252) { D._mx252 = new Float64Array(D.n); for (let k = 0; k < D.n; k++) { let m = 0; for (let q = Math.max(0, k - 251); q <= k; q++) if (D.px[q] > m) m = D.px[q]; D._mx252[k] = m; } } if (D.px[j] <= D._mx252[j] * (1 - p.ddRe)) why = `고점 대비 ${Math.round(p.ddRe * 100)}% 이상 하락 후 20일선 회복 (역발상)`; }
        let viaTimeout = false;
        if (!why && p.maxOut > 0 && above20 && i - outSince >= p.maxOut) { why = `이탈 ${p.maxOut}거래일 경과 · 20일선 위`; viaTimeout = true; }
        if (why) {
          // timeout re-entry options: holdTimeout = hold days after a timeout re-entry (default p.hold);
          // reFracTimeout = share of cash put back on a timeout re-entry, rest when the normal re-entry condition is met
          const fr = viaTimeout ? (p.reFracTimeout ?? 1) : 1;
          const q = sharesOf(1) * D.ix[i]; if (q > 0 && !inA) sell(1, q, i);
          const amt = buy(inA, cash * fr, i); regime = 'in'; fKeep = 1; halfPending = fr < 1;
          lastEntry = viaTimeout && p.holdTimeout != null ? i - (p.hold - p.holdTimeout) : i;
          L(i, 'reentry', `${why} → ${fr < 1 ? Math.round(fr * 100) + '% ' : '전량 '}${inA ? 'QQQ' : 'QLD'} ${fmt(amt * D.fx[i])}`);
        }
      }
      if (SLOW && regime === 'in') {
        const from = inA ? 0 : 1, v0 = sharesOf(from) * (from ? D.ix[i] : LX[i]);
        if (v0 > 0) { const r0 = realized; const pr = sell(from, v0, i); buy(inA, pr, i);
          L(i, inA ? 'down' : 'up', `${inA ? (p.slowSig ? (p.slowName || '감속 신호') : `${p.slowMA}일선 아래`) + ' → QLD를 QQQ로 감속' : '감속 해제 → QQQ를 QLD로'} ${fmt(pr * D.fx[i])} (실현손익 ${fmt(realized - r0)})`); }
      }
    } else if (p.strategy && check && p.exitSig) {
      if (regime === 'in' && p.exitSig[j]) {
        regime = 'out'; exits++; const r0 = realized; const pr = sell(0, sharesOf(0) * LX[i], i); buy(1, pr * p.parkQQQ, i);
        L(i, 'exit', `${p.sigName || '신호'} 이탈 → QLD 전량 매도 ${fmt(pr * D.fx[i])} (실현손익 ${fmt(realized - r0)})`);
      } else if (regime !== 'in' && p.enterSig[j]) {
        const q = sharesOf(1) * D.ix[i]; if (q > 0) sell(1, q, i);
        const amt = buy(0, cash, i); regime = 'in';
        L(i, 'reentry', `${p.sigName || '신호'} 복귀 → 전량 QLD ${fmt(amt * D.fx[i])}`);
      }
    } else if (p.strategy && check && !isNaN(VS[j])) {
      const v = VS[j];
      const MA = p.maGate ? D.ma[p.maGate] : null;
      const OR = MA && p.maMode === 'or';
      const below = MA ? D.px[j] < MA[j] * (1 - p.maBand) : true, above = MA ? D.px[j] > MA[j] * (1 + p.maBand) : false;
      if (regime === 'in') {
        if (OR ? (v > p.volHi || below) : (v > p.volHi && below)) {
          regime = 'out'; exits++; vpk = p.vpkIncludeExit === false ? 0 : v;
          const ef = Math.min(1, Math.max(0, p.exitFrac)); partial = ef < 0.999;
          const r0 = realized; const pr = sell(0, sharesOf(0) * LX[i] * ef, i);
          buy(1, pr * p.parkQQQ, i);
          L(i, 'exit', `변동성 ${(v * 100).toFixed(1)}% > ${(p.volHi * 100).toFixed(0)}%` + (MA ? (OR ? ` 또는 ${p.maGate}일선${p.maBand ? '-' + Math.round(p.maBand * 100) + '%' : ''} 아래` : ` & ${p.maGate}일선 아래`) : '') + ` → QLD ${partial ? Math.round(ef * 100) + '%' : '전량'} 매도 ${fmt(pr * D.fx[i])} (실현손익 ${fmt(realized - r0)})` + (p.parkQQQ > 0 ? `, ${Math.round(p.parkQQQ * 100)}% QQQ 대기` : ''));
        }
      } else {
        if (regime === 'out') vpk = Math.max(vpk, v);
        if (regime === 'out' && partial && p.volHi2 != null && v > p.volHi2) {
          partial = false; const r0 = realized; const pr = sell(0, sharesOf(0) * LX[i], i); buy(1, pr * p.parkQQQ, i);
          L(i, 'exit', `변동성 ${(v * 100).toFixed(1)}% > ${(p.volHi2 * 100).toFixed(0)}% → 남은 QLD 전량 매도 ${fmt(pr * D.fx[i])} (실현손익 ${fmt(realized - r0)})`);
        }
        if (OR ? (above && v < p.volLo) : (v < p.volLo || above)) {
          const r0 = realized; const q = sharesOf(1) * D.ix[i]; if (q > 0) sell(1, q, i);
          const amt = buy(0, cash, i); regime = 'in'; partial = false;
          L(i, 'reentry', (OR ? `나스닥100 ${p.maGate}일선 위 & 변동성 ${(v * 100).toFixed(1)}% < ${(p.volLo * 100).toFixed(0)}%` : above && !(v < p.volLo) ? `나스닥100이 ${p.maGate}일선 위로 회복` : `변동성 ${(v * 100).toFixed(1)}% < ${(p.volLo * 100).toFixed(0)}%`) + ` → 전량 QLD 복귀 ${fmt(amt * D.fx[i])}` + (q > 0 ? ` (QQQ 실현손익 ${fmt(realized - r0)})` : ''));
        } else if (!OR && regime === 'out' && p.reentryFrac > 0 && v < vpk * p.peakRatio) {
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
    const inKRW = (i === i0 ? (p.initialKRW || 0) : 0) + ((i === i0 || D.week[i] !== D.week[i - 1]) ? p.weeklyKRW : 0);
    if (inKRW > 0) {
      const usd = inKRW / (D.fx[i] * (1 + p.fxSpread));
      cash += usd; contributed += inKRW; flowToday = inKRW;
      flows.push([D.day[i], -inKRW]);
      let toQ = 1, toP = 0;
      if (KELLY) { const [wa, wb] = mixOf(tgtE); toQ = wa; toP = wb; }
      else if (p.strategy && p.contribAlways) { toQ = 1; toP = 0; }
      else if (p.strategy && p.rule === 'final' && !p.exitSig && regime === 'in' && (p.slowSig || p.slowMA > 0) && slow) { toQ = 0; toP = 1; }
      else if (p.strategy && p.rule === 'final' && !p.exitSig && regime === 'out') { toQ = p.contribOut || 0; toP = (1 - toQ) * p.parkQQQ; }
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
    expo[k] = v > 0 ? sharesOf(0) * LX[i] * D.fx[i] / v : 0;
    expoTot[k] = v > 0 ? (LV * sharesOf(0) * LX[i] + sharesOf(1) * D.ix[i]) * D.fx[i] / v : 0; tgtS[k] = lastTgt;
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
  const finalAfter = (sharesOf(0) * LX[i] * (1 - p.fee) + sharesOf(1) * D.ix[i] * (1 - p.fee) + cash) * D.fx[i] - liqTax;
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
    mddValue: mddV, mddTwr: mddT, nReb, tgtE, expoTot, tgtS, hold: [sharesOf(0) * LX[i1], sharesOf(1) * D.ix[i1], cash], worstVsPaid: worst, taxesPaid, liqTax, fees, exits, log,
    vals, contr, expo, twr };
}

// buy-and-hold comparison: every contribution (and the optional lump sum) is split between assets by fixed weights; never sells, never rebalances.
// weights: { t: TQQQ, q: QQQ, l: QLD } (sum 1). Tax only at the final liquidation (gains offset across assets, one year's deduction).
function holdBT(D, i0, i1, p) {
  p = Object.assign({ initialKRW: 0, weeklyKRW: 700000, fee: 0.001, fxSpread: 0.001, taxRate: 0.22, deduct: 2500000, w: { t: 0.5, q: 0.5, l: 0 } }, p);
  const A = [['t', D.lx3], ['q', D.ix], ['l', D.lx]].filter(([k]) => p.w[k] > 0);
  const sh = A.map(() => 0), cost = A.map(() => 0);
  const n1 = i1 - i0 + 1, vals = new Float64Array(n1), contr = new Float64Array(n1), twr = new Float64Array(n1), expo = new Float64Array(n1), wT = new Float64Array(n1);
  const flows = []; let contributed = 0, prevVal = 0, fees = 0;
  const LEV = { t: 3, q: 1, l: 2 };
  for (let i = i0; i <= i1; i++) {
    const k = i - i0;
    const inKRW = (i === i0 ? p.initialKRW : 0) + ((i === i0 || D.week[i] !== D.week[i - 1]) ? p.weeklyKRW : 0);
    if (inKRW > 0) {
      const usd = inKRW / (D.fx[i] * (1 + p.fxSpread));
      A.forEach(([key, px], a) => { const u = usd * p.w[key]; sh[a] += u * (1 - p.fee) / px[i]; cost[a] += u * D.fx[i]; fees += u * p.fee * D.fx[i]; });
      contributed += inKRW; flows.push([D.day[i], -inKRW]);
    }
    let v = 0, ex = 0, vt = 0;
    A.forEach(([key, px], a) => { const x = sh[a] * px[i]; v += x; ex += LEV[key] * x; if (key === 't') vt = x; });
    v *= D.fx[i];
    vals[k] = v; contr[k] = contributed; expo[k] = v > 0 ? ex * D.fx[i] / v : 0; wT[k] = v > 0 ? vt * D.fx[i] / v : 0;
    if (k === 0) twr[k] = 1; else { const base = prevVal + inKRW; twr[k] = twr[k - 1] * (base > 0 ? v / base : 1); }
    prevVal = v;
  }
  const i = i1; let gain = 0, gross = 0;
  A.forEach(([key, px], a) => { const net = sh[a] * px[i] * (1 - p.fee) * D.fx[i]; gross += net; gain += net - cost[a]; });
  const liqTax = Math.max(gain - p.deduct, 0) * p.taxRate, finalAfter = gross - liqTax;
  flows.push([D.day[i], finalAfter]);
  let pk = 0, mddV = 0, pkT = 0, mddT = 0, worst = 0;
  for (let k = 0; k < n1; k++) {
    pk = Math.max(pk, vals[k]); if (pk > 0) mddV = Math.min(mddV, vals[k] / pk - 1);
    pkT = Math.max(pkT, twr[k]); mddT = Math.min(mddT, twr[k] / pkT - 1);
    if (contr[k] > 0) worst = Math.min(worst, vals[k] / contr[k] - 1);
  }
  const yrs = (D.day[i1] - D.day[i0]) / 365.25;
  return { finalPre: vals[n1 - 1], finalAfter, liqTax, contributed, irr: xirr(flows), twrCagr: Math.pow(twr[n1 - 1], 1 / yrs) - 1,
    mddTwr: mddT, mddValue: mddV, worstVsPaid: worst, fees, vals, contr, twr, expo, wT };
}

// two-fund leveraged mix (e.g. TQQQ + QQQ) against a 2x fund, with optional ways to pull the mix back to 2x:
//   reb 'none'  : never touch (contributions split by w)
//   reb 'flow'  : no selling; each contribution is split so the account moves back toward 2x
//   reb 'band'  : on check days, if exposure leaves [2-band, 2+band], sell/buy back to 2x (taxable)
//   reb 'year'  : first trading day of each year, sell/buy back to 2x (taxable)
//   reb 'flowband': 'flow' plus a 'band' backstop
// px: { hi: 3x prices, lo: 1x prices } in USD; average-cost basis in KRW; yearly tax on realized gains (deduction, rate),
// paid at year end by selling both funds pro rata; final liquidation taxed once more.
function mixBT(D, i0, i1, px, p) {
  p = Object.assign({ initialKRW: 0, weeklyKRW: 700000, fee: 0.001, fxSpread: 0.001, taxRate: 0.22, deduct: 2500000, w: 0.5, reb: 'none', band: 0.5, check: 'd', levHi: 3, levLo: 1, target: 2, up: 2.3, lo: 1.7, relever: 'sgov', expoBase: 'invested', cashHaircut: 0.001, cashWht: 0.15 }, p);
  const P = [px.hi, px.lo], LV = [p.levHi, p.levLo];
  const sh = [0, 0], basis = [0, 0]; // basis = total KRW cost of current shares
  const n1 = i1 - i0 + 1, vals = new Float64Array(n1), contr = new Float64Array(n1), twr = new Float64Array(n1), expo = new Float64Array(n1), wT = new Float64Array(n1), expoInv = new Float64Array(n1), cashW = new Float64Array(n1);
  const fmtK = x => { const a = Math.abs(x), s = x < 0 ? '−' : ''; return a >= 1e8 ? s + (a / 1e8).toFixed(2) + '억원' : s + Math.round(a / 1e4).toLocaleString('ko-KR') + '만원'; };
  const flows = []; let stage = 0, lowNoted = false, nTrim = 0, nUp = 0, cash = 0, cashMax = 0, contributed = 0, prevVal = 0, fees = 0, realized = 0, taxesPaid = 0, nReb = 0;
  const log = [];
  const valUSD = i => sh[0] * P[0][i] + sh[1] * P[1][i] + cash;
  const expoAt = i => { const v = valUSD(i); return v > 0 ? (LV[0] * sh[0] * P[0][i] + LV[1] * sh[1] * P[1][i]) / v : p.target; };
  const invAt = i => { const T = sh[0] * P[0][i], Q = sh[1] * P[1][i]; return T + Q > 0 ? (LV[0] * T + LV[1] * Q) / (T + Q) : p.target; };
  const state = i => `→ 전체 ${expoAt(i).toFixed(2)}배 · 투자분 ${invAt(i).toFixed(2)}배 · SGOV ${fmtK(cash * D.fx[i])}`;
  const buyCash = (a, usd, i) => { usd = Math.min(usd, cash); if (usd > 0) { cash -= usd; buy(a, usd, i); } };
  function buy(a, usd, i) { if (usd <= 0) return; sh[a] += usd * (1 - p.fee) / P[a][i]; basis[a] += usd * D.fx[i]; fees += usd * p.fee * D.fx[i]; }
  function sell(a, usd, i) { if (usd <= 0 || sh[a] <= 0) return 0; const q = Math.min(sh[a], usd / P[a][i]), frac = q / sh[a], cb = basis[a] * frac;
    const proceeds = q * P[a][i] * (1 - p.fee); realized += proceeds * D.fx[i] - cb; basis[a] -= cb; sh[a] -= q; fees += q * P[a][i] * p.fee * D.fx[i]; return proceeds; }
  function rebalance(i) {
    const v = valUSD(i), e = expoAt(i); if (v <= 0) return;
    // weight of the hi fund that gives the target exposure
    const wt = (p.target - LV[1]) / (LV[0] - LV[1]), want = [wt * v, (1 - wt) * v], have = [sh[0] * P[0][i], sh[1] * P[1][i]];
    const a = have[0] > want[0] ? 0 : 1, b = 1 - a; const cash = sell(a, have[a] - want[a], i); buy(b, cash, i);
    nReb++; log.push({ d: D.day[i], type: 'rebal', msg: `노출 ${e.toFixed(2)}배에서 ${p.target}배로 되돌림 (${a === 0 ? '3배→1배' : '1배→3배'} ${fmtK(cash * D.fx[i])}) ${state(i)}` });
  }
  for (let i = i0; i <= i1; i++) {
    const k = i - i0;
    if (i > i0 && cash > 0) cash *= 1 + Math.max(D.tb[i] - p.cashHaircut, 0) * (1 - p.cashWht) / 252;
    const inKRW = (i === i0 ? p.initialKRW : 0) + ((i === i0 || D.week[i] !== D.week[i - 1]) ? p.weeklyKRW : 0);
    if (inKRW > 0) {
      const usd = inKRW / (D.fx[i] * (1 + p.fxSpread));
      let f = p.w;
      if ((p.reb === 'flow' || p.reb === 'flowband') && i > i0) {
        const T = sh[0] * P[0][i], Q = sh[1] * P[1][i], C = usd * (1 - p.fee), wt = (p.target - LV[1]) / (LV[0] - LV[1]);
        f = Math.min(1, Math.max(0, (wt * (T + Q + C) - T) / C));
      }
      if (p.flowBuf && p.reb === 'sgov2' && i > i0) { // route new money instead of selling: above the trim line it waits in SGOV, below the buy line it all goes to the 3x fund
        const e = expoAt(i);
        if (e > p.up) { cash += usd; f = -1; } else if (e < p.lo) f = 1;
        else if (p.tilt && (e < p.target || p.tilt === 'both')) { // lean the new money toward the target exposure (no selling)
          const V = valUSD(i), T = sh[0] * P[0][i], Q = sh[1] * P[1][i], C = usd * (1 - p.fee);
          f = Math.min(1, Math.max(0, (p.target * (V + C) - LV[0] * T - LV[1] * Q - LV[1] * C) / ((LV[0] - LV[1]) * C)));
        }
      }
      if (f >= 0) { buy(0, usd * f, i); buy(1, usd * (1 - f), i); }
      contributed += inKRW; flows.push([D.day[i], -inKRW]);
    }
    if (i > i0 && (p.reb === 'band' || p.reb === 'flowband')) {
      const chk = p.check === 'd' || (p.check === 'w' ? D.week[i] !== D.week[i - 1] : D.month[i] !== D.month[i - 1]);
      if (chk) { const e = expoAt(i); if (Math.abs(e - p.target) > p.band) rebalance(i); }
    }
    if (i > i0 && p.reb === 'sgov') {
      const chk = p.check === 'd' || (p.check === 'w' ? D.week[i] !== D.week[i - 1] : D.month[i] !== D.month[i - 1]);
      if (chk) {
        const T = sh[0] * P[0][i], Q = sh[1] * P[1][i], inv = T + Q, tau = p.target, kk = (tau - LV[1]) / (LV[0] - tau);
        // 'invested': exposure of the TQQQ+QQQ part only (parked SGOV left out); 'total': whole account incl. SGOV
        const e = p.expoBase === 'invested' ? (inv > 0 ? (LV[0] * T + LV[1] * Q) / inv : tau) : expoAt(i);
        if (e >= p.lo + 0.1) lowNoted = false;
        if (e > p.up) {
          const x = p.expoBase === 'invested' ? T - kk * Q : (e - tau) * valUSD(i) / LV[0];
          const r0 = realized; const pr = sell(0, x, i); cash += pr; nReb++; nTrim++;
          log.push({ d: D.day[i], type: 'down', msg: `${p.expoBase === 'invested' ? '투자분' : '전체'} ${e.toFixed(2)}배 > ${p.up}배: 3배 ${fmtK(pr * D.fx[i])} 팔아 SGOV로 (실현 ${fmtK(realized - r0)}) ${state(i)}` });
        } else if (e < p.lo) {
          const need = p.expoBase === 'invested' ? kk * Q - T : (tau - e) * valUSD(i) / LV[0];
          let fromCash = Math.min(cash, Math.max(0, need));
          if (p.relever === 'all' && cash > 0) { // put every parked dollar back, split so the invested part sits at the target
            const tt = kk / (1 + kk) * (inv + cash), yT = Math.min(cash, Math.max(0, tt - T)); fromCash = cash;
            buyCash(0, yT, i); buyCash(1, cash, i);
          } else if (fromCash > 0) buyCash(0, fromCash, i);
          let swapped = 0;
          if (p.relever === 'full' && need - fromCash > 1e-9) {
            const z = p.expoBase === 'invested' ? (kk * Q - (T + fromCash)) / (1 + kk) : (need - fromCash) * LV[0] / (LV[0] - LV[1]);
            if (z > 0) { const pr = sell(1, z, i); buy(0, pr, i); swapped = pr; }
          }
          if (fromCash > 0 || swapped > 0) { nReb++; nUp++; log.push({ d: D.day[i], type: 'up', msg: `${p.expoBase === 'invested' ? '투자분' : '전체'} ${e.toFixed(2)}배 < ${p.lo}배: SGOV ${fmtK(fromCash * D.fx[i])}${swapped > 0 ? ` + 1배→3배 ${fmtK(swapped * D.fx[i])}` : ''}으로 다시 올림${need - fromCash > 1e-6 && p.relever !== 'full' && p.relever !== 'all' ? ' (SGOV 부족)' : ''} ${state(i)}` }); }
          else if (cash <= 1e-6 && !lowNoted) { lowNoted = true; log.push({ d: D.day[i], type: 'empty', msg: `${p.expoBase === 'invested' ? '투자분' : '전체'} ${e.toFixed(2)}배 < ${p.lo}배인데 SGOV가 없어 그대로 둠` }); }
        }
      }
    }
    if (i > i0 && p.reb === 'sgov2') {
      // generalised SGOV buffer: trim on total or invested exposure, re-lever on total exposure (optionally guarded by the
      // invested exposure), optional staged re-entry and optional SGOV cap whose excess flows back into the mix
      const chk = p.check === 'd' || (p.check === 'w' ? D.week[i] !== D.week[i - 1] : D.month[i] !== D.month[i - 1]);
      if (chk) {
        const tau = p.target, V = valUSD(i), eT = expoAt(i), eI = invAt(i), T = sh[0] * P[0][i], Q = sh[1] * P[1][i];
        const trimE = p.trimBase === 'invested' ? eI : eT, upSell = p.upSell || p.up;
        const levels = p.tranches || [p.lo];
        if (eT >= tau) stage = 0;
        if (trimE > upSell) {
          const to = p.trimTo || tau;
          const x = p.trimBase === 'invested' ? T - (to - LV[1]) / (LV[0] - to) * Q : (eT - to) * V / LV[0];
          const r0 = realized; const pr = sell(0, x, i); cash += pr; nReb++; nTrim++; stage = 0;
          log.push({ d: D.day[i], type: 'down', msg: `${p.trimBase === 'invested' ? '투자분' : '전체'} ${trimE.toFixed(2)}배 > ${upSell}배: 3배 ${fmtK(pr * D.fx[i])} 팔아 SGOV로 (실현 ${fmtK(realized - r0)}) ${state(i)}` });
        } else if (cash > 0 && stage < levels.length && eT < levels[stage] && (!p.relevGuard || eI < p.relevGuard)) {
          const needT = Math.max(0, (tau - eT) * V / LV[0]);
          const frac = p.tranches ? 1 / (levels.length - stage) : 1;
          const amt = Math.min(cash * frac, needT);
          if (amt > 0) { buyCash(0, amt, i); nReb++; nUp++;
            log.push({ d: D.day[i], type: 'up', msg: `전체 ${eT.toFixed(2)}배 < ${levels[stage]}배${p.tranches ? ` (${stage + 1}/${levels.length}차)` : ''}: SGOV ${fmtK(amt * D.fx[i])}으로 3배 매수 ${state(i)}` }); }
          if (p.tranches) stage++;
        }
        if (p.cap && cash > p.cap * valUSD(i)) { const ex = cash - p.cap * valUSD(i); const f = (tau - LV[1]) / (LV[0] - LV[1]); buyCash(0, ex * f, i); buyCash(1, ex * (1 - f), i);
          log.push({ d: D.day[i], type: 'rebal', msg: `SGOV ${Math.round(p.cap * 100)}% 초과분 ${fmtK(ex * D.fx[i])}를 섞기로 되돌림 ${state(i)}` }); }
      }
    }
    if (i > i0 && p.reb === 'year' && D.month[i] !== D.month[i - 1] && D.month[i] === (p.month || 1) && (p.everyMonths ? true : true)) {
      if (!p.upOnly || expoAt(i) > p.target) rebalance(i);
    }
    if (i > i0 && p.reb === 'months' && D.month[i] !== D.month[i - 1] && (D.month[i] - (p.month || 1) + 12) % p.everyMonths === 0) rebalance(i);
    if (i > i0 && p.reb === 'upband') { const chk = p.check === 'd' || D.week[i] !== D.week[i - 1]; if (chk && expoAt(i) > p.target + p.band) rebalance(i); }
    // year end: pay tax on this year's realized gains by selling both funds pro rata
    const lastOfYear = i === D.n - 1 || D.year[i + 1] !== D.year[i];
    if (lastOfYear && i !== i1 && p.harvest) {
      let room = p.deduct - realized; const rStart = realized;
      for (const a2 of [0, 1]) { if (room <= 1 || sh[a2] <= 0) continue; const val = sh[a2] * P[a2][i], g = (val * D.fx[i] - basis[a2]) / (val * D.fx[i]);
        if (g > 0.001) { const sv = Math.min(val, room / g / D.fx[i]); const r0 = realized; const pr = sell(a2, sv, i); buy(a2, pr, i); room -= realized - r0; } }
      if (realized - rStart > 1e4) log.push({ d: D.day[i], type: 'tax', msg: `연말 공제 하베스팅: 차익 ${fmtK(realized - rStart)} 실현 후 바로 재매수 (세금 0, 취득가 상승)` });
    }
    if (lastOfYear && i !== i1) {
      const tax = Math.max(realized - p.deduct, 0) * p.taxRate; realized = 0;
      if (tax > 0) log.push({ d: D.day[i], type: 'tax', msg: `${D.year[i]}년 실현 차익 양도세 ${fmtK(tax)}` });
      if (tax > 0) { let usd = tax / D.fx[i]; const c = Math.min(cash, usd); cash -= c; usd -= c; const v = sh[0] * P[0][i] + sh[1] * P[1][i]; if (usd > 0 && v > 0) { const fr = Math.min(1, usd / v); for (const a of [0, 1]) sell(a, sh[a] * P[a][i] * fr, i); } taxesPaid += tax; }
    }
    const v = valUSD(i) * D.fx[i]; cashMax = Math.max(cashMax, v > 0 ? cash * D.fx[i] / v : 0);
    vals[k] = v; contr[k] = contributed; expo[k] = expoAt(i); expoInv[k] = invAt(i); cashW[k] = v > 0 ? cash * D.fx[i] / v : 0; wT[k] = v > 0 ? sh[0] * P[0][i] * D.fx[i] / v : 0;
    if (k === 0) twr[k] = 1; else { const base = prevVal + inKRW; twr[k] = twr[k - 1] * (base > 0 ? v / base : 1); }
    prevVal = v;
  }
  const i = i1; let gross = cash * D.fx[i], gain = realized;
  for (const a of [0, 1]) { const net = sh[a] * P[a][i] * (1 - p.fee) * D.fx[i]; gross += net; gain += net - basis[a]; }
  const liqTax = Math.max(gain - p.deduct, 0) * p.taxRate, finalAfter = gross - liqTax;
  flows.push([D.day[i], finalAfter]);
  let pk = 0, mddV = 0, pkT = 0, mddT = 0, worst = 0;
  for (let k = 0; k < n1; k++) {
    pk = Math.max(pk, vals[k]); if (pk > 0) mddV = Math.min(mddV, vals[k] / pk - 1);
    pkT = Math.max(pkT, twr[k]); mddT = Math.min(mddT, twr[k] / pkT - 1);
    if (contr[k] > 0) worst = Math.min(worst, vals[k] / contr[k] - 1);
  }
  const yrs = (D.day[i1] - D.day[i0]) / 365.25;
  return { finalPre: vals[n1 - 1], finalAfter, liqTax, taxesPaid, contributed, irr: xirr(flows), twrCagr: Math.pow(twr[n1 - 1], 1 / yrs) - 1,
    mddTwr: mddT, mddValue: mddV, worstVsPaid: worst, fees, nReb, nTrim, nUp, log, cashMax, cashEnd: cash, vals, contr, twr, expo, wT, expoInv, cashW };
}

function xirr(flows) {
  const t0 = flows[0][0];
  const f = r => { let s = 0; for (const [d, c] of flows) s += c / Math.pow(1 + r, (d - t0) / 365.25); return s; };
  let lo = -0.99, hi = 3;
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

if (typeof module !== 'undefined') module.exports = { prepData, runBT, holdBT, mixBT, idxOfDay, DEFAULTS, axesAt, macroOnset, kellyTarget, targetFrom, mixOf };
