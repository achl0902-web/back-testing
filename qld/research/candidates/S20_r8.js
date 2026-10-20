// S20 공통: T09 실시간 매크로 8개(R8) 경보비율·z 로더. D.name으로 시장 선택, 길이 불일치면 throw.
const R8 = require('../data/variants/T09_R8.json');
function load(D) {
  const k = D.name;
  if (k !== 'NDX' && k !== 'SPX2') throw new Error('S20_r8: unknown D.name ' + k);
  const ratio = R8[k], z = R8[k + '_z'];
  if (ratio.length !== D.n) throw new Error(`S20_r8: ${k} ratio length ${ratio.length} != D.n ${D.n}`);
  for (const [nm, a] of Object.entries(z)) if (a.length !== D.n) throw new Error(`S20_r8: ${k}_z.${nm} length ${a.length} != D.n ${D.n}`);
  return { ratio, z };
}
const over = (a, j, th) => a[j] != null && !isNaN(a[j]) && a[j] > th;
module.exports = { load, over };
