// V2 A: keep a macro alarm alive for up to `hold` trading days after its new crossing while the share stays >= th,
// so an onset that lands inside the post-re-entry protection window still exits when protection ends.
// Use with the champion (useMacro stays on); extraExit only adds the remembered days.
module.exports = (D, p) => {
  const th = p.macroTh ?? 0.5, H = p.hold ?? 40, ex = new Uint8Array(D.n);
  let on = -1e9;
  for (let j = 1; j < D.n; j++) {
    const up = D.ms[j] >= th;
    if (up && !(D.ms[j - 1] >= th)) on = j;
    if (!up) on = -1e9;
    ex[j] = up && j - on < H ? 1 : 0;
  }
  return { extraExit: ex };
};
