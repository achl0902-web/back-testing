// S21 A (IDEAS 빈칸 "갭 하락 축" / 약점: 첫 이탈이 −8~−17% 뒤에 나옴): 장중 레인지(고가·저가) 기반 10일 파킨슨 변동성이
// th 이상이면 이탈 표 +1 (extraVoteExit, 복귀 판정에는 쓰지 않음). 레인지 추정은 종가 대 종가보다 효율이 ~5배라 짧은 창으로도
// 잡음이 적고, 종가가 아직 덜 빠진 첫 하락 초반의 장중 흔들림을 축① (20일 종가 하방 변동성)보다 먼저 잡는다는 가설.
// 지수 OHLC(data/macro/OHLC_NDX.csv·OHLC_SPX.csv, 1985~)를 j일까지만 사용. 데이터 없는 날·세트는 표 0.
const fs = require('fs'), path = require('path'), { day } = require('../lib/data.js');
const DIR = path.join(__dirname, '..', '..', 'data', 'macro');
module.exports = (D, p) => {
  const th = p.th ?? 0.3, W = 10, n = D.n, vote = new Uint8Array(n);
  const f = D.name === 'NDX' ? 'OHLC_NDX.csv' : /^SPX/.test(D.name || '') ? 'OHLC_SPX.csv' : null;
  if (!f || !fs.existsSync(path.join(DIR, f))) return { extraVoteExit: vote };
  const m = new Map();
  for (const ln of fs.readFileSync(path.join(DIR, f), 'utf8').trim().split('\n').slice(1)) {
    const [d, h, l] = ln.split(','); if (+h > +l && +l > 0) m.set(day(d), Math.log(+h / +l) ** 2);
  }
  // D.day는 정수 배열이라 .map은 실수를 버림(첫 check 0% 원인) → Array.from
  const x = Array.from(D.day, d => m.has(d) ? m.get(d) : NaN), k = 252 / (4 * Math.log(2));
  for (let j = W - 1; j < n; j++) {
    let s = 0, c = 0;
    for (let i = j - W + 1; i <= j; i++) if (!isNaN(x[i])) { s += x[i]; c++; }
    if (c >= 8 && Math.sqrt(k * s / c) >= th) vote[j] = 1;
  }
  return { extraVoteExit: vote };
};
