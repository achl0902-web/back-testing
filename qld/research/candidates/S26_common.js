// S26 공통 도우미(신호 모듈 아님): 원 요소 모듈(S14_B·S12_inflblock·S22_D)의 계산을 그대로 옮김.
exports.monthWin = (D, pad) => { // S14 B: 놓치는 첫 수익일이 월말·월초 창(−1..+3)에 드는 판정일
  const n = D.n, win = new Uint8Array(n); let t = 0;
  for (let j = 0; j < n; j++) {
    t = (j > 0 && D.month[j] === D.month[j - 1]) ? t + 1 : 1;
    const d = new Date(D.day[j] * 864e5), y = d.getUTCFullYear(), m = d.getUTCMonth();
    const end = Date.UTC(y, m + 1, 0) / 864e5; let dl = 0;
    for (let k = D.day[j] + 1; k <= end; k++) { const w = new Date(k * 864e5).getUTCDay(); if (w && w < 6) dl++; }
    win[j] = (dl <= 2 + pad || t <= 1 + pad) ? 1 : 0;
  }
  return win;
};
exports.inflBlock = (D, K, z, need) => { // S12 B: 달러·PPI·유가 z점수 중 need개 이상이 z 초과면 복귀 금지
  const zs = ['x_dxy', 'i_ppi', 'x_oil'].map(k => K.zOf(D, k).z), b = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) { let c = 0; for (const s of zs) if (s[j] > z) c++; b[j] = c >= need ? 1 : 0; }
  return b;
};
exports.aboveMA = (D, N) => { // S22 D: 지수가 N일선 위
  const m = D.ma[N], s = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) if (m[j] > 0 && D.px[j] > m[j]) s[j] = 1;
  return s;
};
