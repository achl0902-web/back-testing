// Indicator catalog for automatic screening. Every indicator is oriented so that HIGHER = MORE RISK
// (direction fixed by economics, never by backtest), lagged by its publication delay, then z-scored
// on its own trailing 756 trading days (min 252). Screening thresholds are z in {1, 1.5, 2}.
//
// Add indicators here when a strategist proposes a new idea; give it fam, since (first usable year),
// lag (calendar days from observation date to public availability) and a one-line economic reason.
const M = require('./macro.js');

const nanArr = n => new Float64Array(n).fill(NaN);
function ret(a, k) { const o = nanArr(a.length); for (let i = k; i < a.length; i++) if (a[i] > 0 && a[i - k] > 0) o[i] = a[i] / a[i - k] - 1; return o; }
function chg(a, k) { const o = nanArr(a.length); for (let i = k; i < a.length; i++) o[i] = a[i] - a[i - k]; return o; }
function neg(a) { return a.map(v => -v); }
function ratio(a, b) { return a.map((v, i) => (v > 0 && b[i] > 0) ? v / b[i] : NaN); }
function rollMax(a, k) { const o = nanArr(a.length); for (let i = 0; i < a.length; i++) { let m = -Infinity; for (let j = Math.max(0, i - k + 1); j <= i; j++) if (a[j] > m) m = a[j]; o[i] = i >= k - 1 ? m : NaN; } return o; }
function rollMin(a, k) { const o = nanArr(a.length); for (let i = 0; i < a.length; i++) { let m = Infinity; for (let j = Math.max(0, i - k + 1); j <= i; j++) if (a[j] < m) m = a[j]; o[i] = i >= k - 1 ? m : NaN; } return o; }
function sma(a, k) { const o = nanArr(a.length); let s = 0, n = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= k) s -= a[i - k]; if (i >= k - 1) o[i] = s / k; } return o; }
function ema(a, k) { const o = nanArr(a.length); const al = 2 / (k + 1); let e = NaN; for (let i = 0; i < a.length; i++) { if (isNaN(a[i])) { o[i] = e; continue; } e = isNaN(e) ? a[i] : e + al * (a[i] - e); o[i] = e; } return o; }
function rsi(a, k = 14) { const o = nanArr(a.length); let ag = 0, al = 0; for (let i = 1; i < a.length; i++) { const c = a[i] - a[i - 1]; if (i <= k) { ag += Math.max(c, 0) / k; al += Math.max(-c, 0) / k; if (i === k) o[i] = 100 - 100 / (1 + ag / (al || 1e-12)); } else { ag = (ag * (k - 1) + Math.max(c, 0)) / k; al = (al * (k - 1) + Math.max(-c, 0)) / k; o[i] = 100 - 100 / (1 + ag / (al || 1e-12)); } } return o; }
function rollStd(a, k) { const o = nanArr(a.length); for (let i = k - 1; i < a.length; i++) { let s = 0, s2 = 0, n = 0; for (let j = i - k + 1; j <= i; j++) if (!isNaN(a[j])) { s += a[j]; s2 += a[j] * a[j]; n++; } if (n >= k * 0.8) { const m = s / n; o[i] = Math.sqrt(Math.max(s2 / n - m * m, 0)); } } return o; }
function rollCorr(a, b, k) { const o = nanArr(a.length); for (let i = k - 1; i < a.length; i++) { let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0; for (let j = i - k + 1; j <= i; j++) { const x = a[j], y = b[j]; if (isNaN(x) || isNaN(y)) continue; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; n++; } if (n >= k * 0.8) { const cv = sab / n - sa / n * sb / n, va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2; o[i] = va > 0 && vb > 0 ? cv / Math.sqrt(va * vb) : NaN; } } return o; }
function dret(a) { const o = nanArr(a.length); for (let i = 1; i < a.length; i++) if (a[i] > 0 && a[i - 1] > 0) o[i] = a[i] / a[i - 1] - 1; return o; }
const yoy = a => ret(a, 252);

// trailing z-score, O(n) with valid-value counts
function zscore(a, win = 756, min = 252) {
  const n = a.length, o = nanArr(n); let s = 0, s2 = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const v = a[i]; if (!isNaN(v)) { s += v; s2 += v * v; c++; }
    if (i >= win) { const u = a[i - win]; if (!isNaN(u)) { s -= u; s2 -= u * u; c--; } }
    if (c >= min && !isNaN(v)) { const m = s / c, sd = Math.sqrt(Math.max(s2 / c - m * m, 1e-18) * c / (c - 1)); o[i] = Math.max(-4, Math.min(4, (v - m) / sd)); }
  }
  return o;
}

// share of 8 sector/size series (XLK XLF XLY XLP SOX RUT SPX NDX) closing below their own 200-day mean (NaN until all have 200 valid days)
function breadth(D) {
  const ks = ['Y_XLK', 'Y_XLF', 'Y_XLY', 'Y_XLP', 'Y_SOX', 'Y_RUT', 'Y_SPX', 'Y_NDX'], o = nanArr(D.n);
  const below = ks.map(k => { const a = M.series(D, k, 0), b = nanArr(D.n); let s = 0, c = 0;
    for (let i = 0; i < D.n; i++) { c = isNaN(a[i]) ? 0 : c + 1; s += isNaN(a[i]) ? 0 : a[i]; if (c === 0) s = 0;
      if (c > 200) s -= a[i - 200];
      if (c >= 200) b[i] = a[i] < s / 200 ? 1 : 0; }
    return b; });
  for (let i = 0; i < D.n; i++) { let t = 0, ok = true; for (const b of below) { if (isNaN(b[i])) { ok = false; break; } t += b[i]; } if (ok) o[i] = t / ks.length; }
  return o;
}
const S = (D, name, lag) => M.series(D, name, lag);
// [key, family, label, since, build(D) -> raw (higher = riskier)]
const CATALOG = [
  // ---- price / trend (the tested index itself) ----
  ['p_ret21', 'price', '1개월 하락폭', 1986, D => neg(ret(D.px, 21))],
  ['p_ret63', 'price', '3개월 하락폭', 1986, D => neg(ret(D.px, 63))],
  ['p_ret126', 'price', '6개월 하락폭', 1986, D => neg(ret(D.px, 126))],
  ['p_ret252', 'price', '12개월 하락폭 (시계열 모멘텀)', 1986, D => neg(ret(D.px, 252))],
  ['p_ma50', 'price', '50일선 아래 깊이', 1986, D => D.px.map((v, i) => -(v / D.ma[50][i] - 1))],
  ['p_ma200', 'price', '200일선 아래 깊이', 1986, D => D.px.map((v, i) => -(v / D.ma[200][i] - 1))],
  ['p_ma200slope', 'price', '200일선 하락 기울기', 1986, D => neg(ret(Array.from(D.ma[200]), 21))],
  ['p_dd252', 'price', '52주 고점 대비 낙폭', 1986, D => { const mx = rollMax(Array.from(D.px), 252); return D.px.map((v, i) => -(v / mx[i] - 1)); }],
  ['p_low63', 'price', '3개월 저점 근접', 1986, D => { const mn = rollMin(Array.from(D.px), 63); return D.px.map((v, i) => -(v / mn[i] - 1)); }],
  ['p_rsi14', 'price', '일봉 RSI 약세', 1986, D => neg(rsi(Array.from(D.px), 14))],
  ['p_rsiw', 'price', '주봉 RSI 약세', 1986, D => neg(Array.from(D.rsiw))],
  ['p_macdw', 'price', '중기 MACD 하락 (EMA 60/130)', 1986, D => { const a = Array.from(D.px), e1 = ema(a, 60), e2 = ema(a, 130); const m = e1.map((v, i) => v - e2[i]); const sg = ema(Array.from(m), 45); return m.map((v, i) => -(v - sg[i]) / D.px[i]); }],
  // ---- volatility ----
  ['v_rv20', 'vol', '20일 변동성', 1986, D => Array.from(D.vols.rv20)],
  ['v_down20', 'vol', '20일 하방 변동성', 1986, D => Array.from(D.vols.down20)],
  ['v_up20', 'vol', '20일 상방 변동성', 1986, D => Array.from(D.vols.up20)],
  ['v_ratio', 'vol', '10일/60일 변동성', 1986, D => D.vols.rv10.map((v, i) => v / D.v60[i])],
  ['v_volvol', 'vol', '변동성의 변동성 (63일)', 1986, D => rollStd(Array.from(D.vols.rv20), 63)],
  ['v_vix', 'vol', 'VIX', 1990, D => S(D, 'VIXCLS', 1)],
  ['v_vixterm', 'vol', 'VIX / 3개월 VIX', 2008, D => ratio(S(D, 'VIXCLS', 1), S(D, 'VXVCLS', 1))],
  ['v_vxn', 'vol', '나스닥 VIX (VXN)', 2001, D => S(D, 'VXNCLS', 1)],
  ['v_move', 'vol', '채권 변동성 MOVE', 2003, D => S(D, 'Y_MOVE', 1)],
  // ---- cross-asset / market internals ----
  ['x_ndxspx', 'xasset', '나스닥/S&P 3개월 약세', 1986, D => neg(ret(ratio(S(D, 'Y_NDX', 0), S(D, 'Y_SPX', 0)), 63))],
  ['x_small', 'xasset', '소형주/대형주 6개월 약세', 1988, D => neg(ret(ratio(S(D, 'Y_RUT', 0), S(D, 'Y_SPX', 0)), 126))],
  ['x_rsp', 'xasset', '동일가중/시총가중 3개월 약세 (폭)', 2004, D => neg(ret(ratio(S(D, 'Y_RSP', 0), S(D, 'Y_SPY', 0)), 63))],
  ['x_semis', 'xasset', '반도체/나스닥 3개월 약세', 1995, D => neg(ret(ratio(S(D, 'Y_SOX', 0), S(D, 'Y_NDX', 0)), 63))],
  ['x_xlyxlp', 'xasset', '경기소비재/필수소비재 3개월 약세', 1999, D => neg(ret(ratio(S(D, 'Y_XLY', 0), S(D, 'Y_XLP', 0)), 63))],
  ['x_fin', 'xasset', '금융주/S&P 3개월 약세', 1999, D => neg(ret(ratio(S(D, 'Y_XLF', 0), S(D, 'Y_SPY', 0)), 63))],
  ['x_kre', 'xasset', '지역은행 3개월 하락', 2007, D => neg(ret(S(D, 'Y_KRE', 0), 63))],
  ['x_cugold', 'xasset', '구리/금 6개월 하락', 2001, D => neg(ret(ratio(S(D, 'Y_COPPER', 0), S(D, 'Y_GOLD', 0)), 126))],
  ['x_gold', 'xasset', '금 3개월 상승 (안전자산 쏠림)', 2001, D => ret(S(D, 'Y_GOLD', 0), 63)],
  ['x_dxy', 'xasset', '달러 6개월 상승', 1986, D => ret(S(D, 'Y_DXY', 0), 126)],
  ['x_oil', 'xasset', '유가 6개월 상승', 1987, D => ret(S(D, 'DCOILWTICO', 1), 126)],
  ['x_tlt', 'xasset', '장기채 3개월 하락', 2003, D => neg(ret(S(D, 'Y_TLT', 0), 63))],
  ['x_breadth', 'xasset', '섹터·규모 8개 중 200일선 아래 비율 (시장 폭, S12)', 2000, D => breadth(D)],
  ['x_sbcorr', 'xasset', '주식-채권 63일 상관 (양이면 인플레 국면)', 1986, D => { const y = S(D, 'Y_TNX', 0); const dy = chg(y, 1).map(v => -v); return rollCorr(Array.from(dret(D.px)), Array.from(dy), 63); }],
  // ---- credit ----
  ['c_baa', 'credit', 'BAA 스프레드', 1987, D => S(D, 'BAA10Y', 1)],
  ['c_baa63', 'credit', 'BAA 스프레드 3개월 확대', 1987, D => chg(S(D, 'BAA10Y', 1), 63)],
  ['c_dflt', 'credit', 'BAA-AAA 부도 스프레드', 1987, D => { const b = S(D, 'BAA10Y', 1), a = S(D, 'AAA10Y', 1); return b.map((v, i) => v - a[i]); }],
  ['c_hyg', 'credit', '하이일드/국채 3개월 약세', 2008, D => neg(ret(ratio(S(D, 'Y_HYG', 0), S(D, 'Y_IEF', 0)), 63))],
  ['c_lqd', 'credit', '투자등급/국채 3개월 약세', 2003, D => neg(ret(ratio(S(D, 'Y_LQD', 0), S(D, 'Y_IEF', 0)), 63))],
  // ---- rates / policy ----
  ['r_tnx63', 'rates', '10년 금리 3개월 상승', 1986, D => chg(S(D, 'Y_TNX', 0), 63)],
  ['r_tnx126', 'rates', '10년 금리 6개월 상승', 1986, D => chg(S(D, 'Y_TNX', 0), 126)],
  ['r_dgs2', 'rates', '2년 금리 3개월 상승', 1986, D => chg(S(D, 'DGS2', 1), 63)],
  ['r_hike', 'rates', '기준금리 6개월 인상폭', 1986, D => chg(S(D, 'DFF', 1), 126)],
  ['r_cut', 'rates', '기준금리 6개월 인하폭', 1986, D => neg(chg(S(D, 'DFF', 1), 126))],
  ['r_inv', 'rates', '장단기 역전 깊이 (10Y-3M)', 1986, D => neg(S(D, 'T10Y3M', 1))],
  ['r_steep', 'rates', '장단기차 3개월 재가팽창', 1986, D => chg(S(D, 'T10Y3M', 1), 63)],
  ['r_real', 'rates', '10년 실질금리 6개월 상승', 2004, D => chg(S(D, 'DFII10', 1), 126)],
  // ---- inflation ----
  ['i_cpi', 'inflation', 'CPI 전년비', 1986, D => yoy(S(D, 'CPIAUCSL', 50))],
  ['i_core', 'inflation', '근원 CPI 전년비', 1986, D => yoy(S(D, 'CPILFESL', 50))],
  ['i_cpiacc', 'inflation', 'CPI 전년비 6개월 가속', 1987, D => chg(yoy(S(D, 'CPIAUCSL', 50)), 126)],
  ['i_ppi', 'inflation', 'PPI 전년비', 1986, D => yoy(S(D, 'PPIACO', 50))],
  ['i_be', 'inflation', '10년 기대인플레이션', 2004, D => S(D, 'T10YIE', 1)],
  // ---- labour ----
  ['l_claims', 'labor', '실업수당 4주평균 전년비', 1986, D => { const c = S(D, 'ICSA', 5); const a = sma(Array.from(c), 20); return yoy(a); }],
  ['l_sahm', 'labor', '실시간 삼의 법칙', 1986, D => S(D, 'SAHMREALTIME', 40)],
  ['l_unrate', 'labor', '실업률 12개월 저점 대비 상승', 1986, D => { const u = S(D, 'UNRATE', 40); const mn = rollMin(Array.from(u), 252); return u.map((v, i) => v - mn[i]); }],
  // ---- financial conditions / liquidity ----
  ['f_nfci', 'liquidity', '시카고 연준 금융여건 NFCI', 1986, D => S(D, 'NFCI', 5)],
  ['f_nfcir', 'liquidity', 'NFCI 위험 하위지수', 1986, D => S(D, 'NFCIRISK', 5)],
  ['f_stl', 'liquidity', '세인트루이스 금융스트레스', 1994, D => S(D, 'STLFSI4', 6)],
  ['f_m2', 'liquidity', 'M2 전년비 둔화', 1986, D => neg(yoy(S(D, 'M2SL', 55)))],
  ['f_walcl', 'liquidity', '연준 자산 전년비 축소', 2004, D => neg(yoy(S(D, 'WALCL', 2)))],
  ['f_ms', 'liquidity', '챔피언 매크로 경보 비율', 1989, D => Array.from(D.ms)],
  // S28: 연준 Z.1 증권사 신용 계정(분기, 날짜=분기 첫날) → 분기 끝 + 발표 약 75일 = 날짜 기준 시차 165일. 레버리지 과열(급증)일수록 위험
  ['f_margin', 'liquidity', '신용융자(Z.1) 전년비 증가 (S28)', 1953, D => ret(S(D, 'MARGIN_Z1', 165), 252)],
  // S28: CBOE 총 Put/Call 10일 평균(1995-09~2003-12 아카이브 + 2006-11~2019-10, 시차 1일, 공백·이후는 NaN). 높을수록 공포(헤지 수요)
  ['v_pc', 'vol', 'Put/Call 10일 평균 (S28, 실시간 자료원 없음)', 1996, D => require('../candidates/S28_common.js').pc10(D)],
];
const BY = Object.fromEntries(CATALOG.map(c => [c[0], c]));

const cache = new Map();
function zOf(D, key) {
  const k = D.name + '|' + key;
  if (!cache.has(k)) {
    const c = BY[key]; if (!c) throw new Error('unknown indicator ' + key);
    let raw = c[4](D); raw = Float64Array.from(raw, v => (v === undefined || !isFinite(v)) ? NaN : v);
    cache.set(k, { raw, z: zscore(raw) });
  }
  return cache.get(k);
}
module.exports = { CATALOG, BY, zOf, zscore, helpers: { ret, chg, neg, ratio, rollMax, rollMin, sma, ema, rsi, rollStd, rollCorr, dret, yoy } };
