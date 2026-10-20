// T09: macro exits from an alternative alarm-share series (data/variants/T09_<variant>.json): new crossings of 50% as extraExit.
// Use with params { useMacro: false, variant: 'V1' }. With the stored share this reproduces the champion exactly (T06 sanity).
const fs = require('fs'), path = require('path');
module.exports = (D, p) => {
  const ms = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'variants', `T09_${p.variant}.json`)))[D.name];
  if (ms.length !== D.n) throw new Error(`T09_${p.variant}.json 길이 ${ms.length} ≠ 데이터 ${D.n}: python3 lib/macro_variants.py ${p.variant} 로 다시 만들 것`);
  const ex = new Uint8Array(D.n), th = 0.5;
  for (let j = 1; j < D.n; j++) ex[j] = ms[j] != null && ms[j] >= th && !(ms[j - 1] != null && ms[j - 1] >= th) ? 1 : 0;
  return { extraExit: ex };
};
