// T10 smoke test only: constant pauseSig / contribSig (mode 'pause1', 'contrib1')
module.exports = (D, p) => { const a = new Uint8Array(D.n).fill(1); return p.mode === 'pause1' ? { pauseSig: a } : { contribSig: a }; };
