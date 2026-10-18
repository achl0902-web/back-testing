// Generic catalog candidate: params { ind: <catalog key>, hook: 'vote'|'alarm'|'block', z: threshold, [ind2, z2]: optional AND-condition }
//   vote  -> extraVoteExit (counts toward the exit vote only)
//   alarm -> extraExit on the onset day (z newly above threshold)
//   block -> reentryBlock while z above threshold
const { zOf, BY } = require('./catalog.js');
module.exports = (D, p) => {
  const { z } = zOf(D, p.ind), th = p.z ?? 1.5, n = D.n;
  const z2 = p.ind2 ? zOf(D, p.ind2).z : null, th2 = p.z2 ?? th;
  const on = new Uint8Array(n); for (let j = 0; j < n; j++) on[j] = (z[j] > th && (!z2 || z2[j] > th2)) ? 1 : 0;
  const name = ((BY[p.ind] || [])[2] || p.ind) + (p.ind2 ? ' + ' + ((BY[p.ind2] || [])[2] || p.ind2) : '');
  if (p.hook === 'vote') return { extraVoteExit: on, extraName: name };
  if (p.hook === 'alarm') { const a = new Uint8Array(n); for (let j = 1; j < n; j++) a[j] = on[j] && !on[j - 1] ? 1 : 0; return { extraExit: a, extraName: name }; }
  if (p.hook === 'block') return { reentryBlock: on, extraName: name };
  throw new Error('hook must be vote|alarm|block');
};
