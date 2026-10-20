// S18 B: 신용 지표 경보(매크로 14개 대체). 신용 5개(c_baa, c_baa63, c_dflt, f_stl, f_nfcir; 발표 시차·z 적용) 중
// z > zTh 인 비율이 frac 을 새로 넘는 날 이탈(extraExit). 비율은 값이 있는 지표 기준, 3개 미만이면 0. 엔진 params.useMacro=false.
const C = require('../lib/catalog.js');
const KEYS = ['c_baa', 'c_baa63', 'c_dflt', 'f_stl', 'f_nfcir'];
module.exports = (D, p) => {
  const n = D.n, zs = KEYS.map(k => C.zOf(D, k).z), zTh = p.zTh ?? 1, fr = p.frac ?? 0.5;
  const f = new Float64Array(n), x = new Uint8Array(n);
  for (let j = 0; j < n; j++) {
    let on = 0, av = 0;
    for (const z of zs) { const v = z[j]; if (isFinite(v)) { av++; if (v > zTh) on++; } }
    f[j] = av >= 3 ? on / av : 0;
    x[j] = j > 0 && f[j] > fr && !(f[j - 1] > fr) ? 1 : 0;
  }
  return { extraExit: x };
};
