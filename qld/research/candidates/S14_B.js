// S14 B 달력(월말·월초 효과, Lakonishok-Smidt 1988, McConnell-Xu 2008): 월말 마지막 거래일 ~ 월초 3거래일(−1..+3)에 수익이 몰린다.
// 엔진은 j일 신호를 j+1일 종가에 매매하므로 j일 이탈은 j+2일부터의 수익을 놓친다. 놓치는 첫날이 월말·월초 창에 들어가는
// 판정일(월말 남은 평일 ≤ 2+pad, 또는 이번 달 거래일 순번 ≤ 1+pad)에는 기술 이탈에 1표 더 요구. 매크로 경보·복귀는 그대로.
// 월말 남은 평일은 달력(공휴일 무시)으로만 계산, 월 순번은 지난 날짜로만 계산 → 미래 정보 없음.
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const n = D.n, pad = p.pad, win = new Uint8Array(n);
  let t = 0;
  for (let j = 0; j < n; j++) {
    t = (j > 0 && D.month[j] === D.month[j - 1]) ? t + 1 : 1;
    const d = new Date(D.day[j] * 864e5), y = d.getUTCFullYear(), m = d.getUTCMonth();
    const end = Date.UTC(y, m + 1, 0) / 864e5; let dl = 0;
    for (let k = D.day[j] + 1; k <= end; k++) { const w = new Date(k * 864e5).getUTCDay(); if (w && w < 6) dl++; }
    win[j] = (dl <= 2 + pad || t <= 1 + pad) ? 1 : 0;
  }
  return L.run(D, { exitVotes: (j, base) => win[j] ? base + 1 : base });
};
