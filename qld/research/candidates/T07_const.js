module.exports = (D, p) => { const t = new Float64Array(D.n).fill(p.v); return { qldTarget: t }; };
