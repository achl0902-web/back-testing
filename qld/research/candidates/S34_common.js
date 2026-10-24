// S34 공통 도우미(신호 모듈 아님): 예정된 매크로 발표일 표시와, 그날 수익률을 뺀 변동성 축.
//  - 고용 보고서(Employment Situation): BLS 규칙 근사 = 기준 주(12일이 든 일~토 주)가 끝난 뒤 셋째 금요일. 발표 08:30 ET(개장 전)
//    → 그날 종가에 반영(시차 0). 그날이 휴장이면 다음 거래일. 1985-01 이후만 쓴다(그 전 발표 관행은 미확인).
//    예외(7월 3일 휴일로 목요일 발표, 셧다운 2013-10·2025-10~11 지연)는 근사에 안 맞음 → 실제 발표일은 dataRequest(ALFRED vintagedates)로 재확인.
//  - FOMC 성명: data/macro/FOMC_DATES.csv(1994-02~, S33_common.fomcAge의 경과 0일). 14:15 ET 발표 → 그날 종가.
//  발표일은 미리 공표되는 일정이고(비예정 FOMC는 발표일 당일에야 알지만 그날 종가 수익률만 지움), 지우는 것은 j일까지의 수익률뿐 → 미래 정보 없음.
const E = require('../../src/engine.js'), U3 = require('./S33_common.js'), P0 = E.DEFAULTS;
const memo = new Map();
function jobsDays(D) {
  const o = new Uint8Array(D.n), y0 = new Date(D.day[0] * 864e5).getUTCFullYear(), y1 = new Date(D.day[D.n - 1] * 864e5).getUTCFullYear();
  for (let y = Math.max(1984, y0 - 1); y <= y1; y++) for (let m = 0; m < 12; m++) {
    const d12 = Date.UTC(y, m, 12) / 864e5, dow = new Date(d12 * 864e5).getUTCDay(), sat = d12 + (6 - dow), rel = sat + 6 + 14;
    if (rel < Date.UTC(1985, 0, 1) / 864e5) continue;
    let k = 0; while (k < D.n && D.day[k] < rel) k++;
    if (k < D.n && D.day[k] - rel <= 4) o[k] = 1;
  }
  return o;
}
// 발표일 표시(span=1: 발표일만, 2: 발표일과 다음 거래일)
exports.annMask = (D, span) => { const key = 'ann' + span + '|' + D.n + '|' + D.day[0]; if (memo.has(key)) return memo.get(key);
  const jb = jobsDays(D), age = U3.fomcAge(D), a = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) if (jb[j] || age[j] === 0) for (let s = 0; s < span && j + s < D.n; s++) a[j + s] = 1;
  memo.set(key, a); return a; };
// 축①(20일 하방>30% 또는 상방>35%)과 축④(10일/60일 변동성>1.6배)를 발표일 수익률을 뺀 표본으로 다시 계산(엔진과 같은 식, 분모는 남은 날 수).
// 창 안에 발표일이 없으면 엔진 값과 정확히 같다. 축②(10일 −8%)·축③(주봉 RSI<45)과 복귀 조건 10일<60일 변동성은 엔진 값 그대로.
exports.axesEx = (D, span) => { const key = 'ax' + span + '|' + D.n + '|' + D.day[0]; if (memo.has(key)) return memo.get(key);
  const a = exports.annMask(D, span), n = D.n, ret = new Float64Array(n), out = new Uint8Array(n), v1 = new Uint8Array(n), v4 = new Uint8Array(n);
  for (let i = 1; i < n; i++) ret[i] = D.px[i] / D.px[i - 1] - 1;
  const sd = (i, w) => { let s = 0, c = 0; for (let k = i - w + 1; k <= i; k++) if (!a[k]) { s += ret[k]; c++; } if (c < 3) return NaN; const m = s / c; let s2 = 0;
    for (let k = i - w + 1; k <= i; k++) if (!a[k]) s2 += (ret[k] - m) ** 2; return Math.sqrt(s2 / (c - 1)) * Math.sqrt(252); };
  for (let i = 61; i < n; i++) {
    let dn = 0, up = 0, c = 0; for (let k = i - 19; k <= i; k++) if (!a[k]) { c++; if (ret[k] < 0) dn += ret[k] * ret[k]; else if (ret[k] > 0) up += ret[k] * ret[k]; }
    const d20 = c ? Math.sqrt(dn / c * 252) * Math.SQRT2 : 0, u20 = c ? Math.sqrt(up / c * 252) * Math.SQRT2 : 0;
    v1[i] = (d20 > P0.dnHi || u20 > P0.upHi) ? 1 : 0;
    const r10 = sd(i, 10), r60 = sd(i, 60); v4[i] = (r60 > 0 && r10 / r60 > P0.expand) ? 1 : 0;
    const x = E.axesAt(D, P0, i); out[i] = v1[i] + x[1] + x[2] + v4[i];
  }
  const r = { n: out, v1, v4 }; memo.set(key, r); return r; };
