#!/usr/bin/env node
// One research step as a code pipeline (PROTOCOL v3). The LLM only writes the plan + modules and judges flagged results.
//   node lib/step.js prep                       pull, refresh data, next step number, wide screen only if catalog changed/data aged
//   node lib/step.js check Sxx                  load every planned config: errors and signal on-rate (no scoring, not a trial)
//   node lib/step.js run Sxx                    commit the plan (pre-registration), screen all configs, battery the best per
//                                               direction, write steps/Sxx.md, print a short digest with the review gate
//   node lib/step.js close Sxx --verdict 기각 --why "..." [--ideas '[{"row","tested","result","gap"}]'] [--session URL]
//   node lib/step.js criteria                   print the adoption criteria, warnings and habits from PROTOCOL.md (for the judge)
// Plan file steps/Sxx-plan.json:
//   {"step":"S12","goal":"...","directions":[{"id":"A","type":"이탈 시점","title":"...","why":"근거·겨냥 사례",
//     "predict":"맞다면 무엇이 좋아지고 무엇은 그대로인가","signals":"candidates/S12_A.js","params":{"strategy":true},
//     "vary":{"key":[v1,v2,v3]}}, ...]}
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const R = path.join(__dirname, '..'), Q = path.join(R, '..'), ROOT = path.join(Q, '..');
const args = process.argv.slice(2), cmd = args[0], step = args[1];
const opt = (f, d) => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : d; };
const sh = (c, o = {}) => execSync(c, Object.assign({ cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }, o));
const hash = f => require('crypto').createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
const iso = d => new Date(d * 864e5).toISOString().slice(0, 10);
const stepNo = () => Math.max(...(fs.readFileSync(path.join(R, 'LEDGER.md'), 'utf8').match(/^\| S(\d+) /gm) || ['| S0 ']).map(x => +x.match(/\d+/)[0])) + 1;

function loadPlan(s) {
  const f = path.join(R, 'steps', `${s}-plan.json`);
  if (!fs.existsSync(f)) { console.error(`계획 파일 없음: steps/${s}-plan.json`); process.exit(1); }
  const P = JSON.parse(fs.readFileSync(f, 'utf8')), D = P.directions || [], err = [];
  if (D.length < 3 || D.length > 4) err.push(`방향 ${D.length}개 (3~4개)`);
  if (new Set(D.map(d => d.type)).size < Math.min(3, D.length)) err.push('행동 유형이 3가지 미만');
  for (const d of D) {
    const ks = Object.keys(d.vary || {});
    if (!d.id || !/^[A-Z]$/.test(d.id)) err.push(`id는 대문자 한 글자: ${d.id}`);
    if (ks.length > 2) err.push(`${d.id}: 자유 파라미터 ${ks.length}개 (최대 2)`);
    if (ks.some(k => d.vary[k].length > 3)) err.push(`${d.id}: 파라미터당 값 최대 3개`);
    if (!d.why || !d.predict) err.push(`${d.id}: why·predict 필수`);
  }
  if (err.length) { console.error('계획 오류: ' + err.join(' · ')); process.exit(1); }
  return { f, P };
}
function configs(s, d) {
  let combos = [{}];
  for (const [k, vs] of Object.entries(d.vary || {})) combos = combos.flatMap(c => vs.map(v => Object.assign({}, c, { [k]: v })));
  return combos.map(g => ({ name: `${d.id}:${d.title}` + (Object.keys(g).length ? '·' + Object.entries(g).map(([k, v]) => `${k}=${v}`).join(',') : ''),
    step: s, by: 'strategist', fam: d.id, label: d.type, signals: d.signals, params: Object.assign({ strategy: true }, d.params || {}, g), _g: g }));
}
const strip = c => { const o = Object.assign({}, c); delete o._g; if (!o.signals) delete o.signals; return o; };

if (cmd === 'prep') {
  try { sh('git pull -q --rebase', { cwd: ROOT }); } catch (e) { console.log('git pull 실패: ' + String(e.stderr || e).slice(0, 120)); }
  let refreshed = '';
  try { sh('python3 research/refresh_data.py', { cwd: Q, timeout: 180000 }); refreshed = '새로고침 성공'; } catch { refreshed = '새로고침 실패(네트워크), 기존 데이터 사용'; }
  const C = require('./core.js'), { ND } = C.load(); C.cached('dca', {}); C.cached('champ', {});
  const s = `S${String(stepNo()).padStart(2, '0')}`, last = iso(ND.day[ND.n - 1]);
  const wf = path.join(R, 'steps', 'WIDE.json'), W = fs.existsSync(wf) ? JSON.parse(fs.readFileSync(wf)) : {};
  const cat = hash(path.join(R, 'lib', 'catalog.js'));
  const aged = !W.dataDate || (new Date(last) - new Date(W.dataDate)) / 864e5 > 90;
  let wide = `넓은 스크린 재사용 (${W.step || '-'}, 카탈로그 변동 없음)`;
  if (W.catalog !== cat || aged) {
    const o = sh(`node lib/screen.js --step ${s} --top 5 2>/dev/null`, { timeout: 900000 });
    fs.writeFileSync(wf, JSON.stringify({ step: s, catalog: cat, dataDate: last }));
    wide = '넓은 스크린 실행:\n' + o.split('\n').filter(l => /^\s+-?\d|점수 0 초과/.test(l)).slice(0, 6).join('\n');
  }
  sh('node lib/brief.js', {});
  console.log(`다음 스텝 ${s} · 데이터 ${last}까지 (${refreshed})\n${wide}\n전략가에게: BRIEF.md만, 계획은 steps/${s}-plan.json`);
}

else if (cmd === 'check') {
  const { f: pf, P } = loadPlan(step), C = require('./core.js'), { ND } = C.load();
  // audit trail: the first check freezes a snapshot; run lists every value changed after it (PROTOCOL v3.1)
  const snap = path.join(R, 'steps', `${step}-plan.check1.json`);
  if (!fs.existsSync(snap)) { fs.copyFileSync(pf, snap); console.log(`계획 스냅샷 저장: steps/${step}-plan.check1.json (이후 값 변경은 run 보고에 표시됨)`); }
  const i99 = ND.day.findIndex(d => d >= C.day('1999-01-04'));
  for (const d of P.directions) for (const c of configs(step, d)) {
    if (!c.signals) { console.log(`${c.name}: 신호 모듈 없음 (엔진 파라미터만)`); continue; }
    try {
      const mod = require(path.resolve(R, c.signals)), out = mod(ND, c.params, ...require('./data.js').highLow(ND));
      const rates = Object.entries(out).filter(([, a]) => a && a.length === ND.n).map(([k, a]) => { let on = 0; for (let j = i99; j < ND.n; j++) on += a[j] ? 1 : 0; return `${k} ${(100 * on / (ND.n - i99)).toFixed(1)}%`; });
      console.log(`${c.name}: ${rates.join(' · ') || '배열 없음(확인 필요)'}`);
    } catch (e) { console.log(`${c.name}: 오류 ${String(e).slice(0, 160)}`); }
  }
}

else if (cmd === 'run') {
  const { f, P } = loadPlan(step);
  // pre-registration: the plan and its modules are committed before anything is scored
  const snapF = path.join(R, 'steps', `${step}-plan.check1.json`), audit = [];
  if (fs.existsSync(snapF)) {
    const S0 = JSON.parse(fs.readFileSync(snapF, 'utf8')), key = d => JSON.stringify({ p: d.params || {}, v: d.vary || {}, n: d.neighbors || null, s: d.signals || null });
    for (const d of P.directions) { const o = (S0.directions || []).find(x => x.id === d.id); if (!o) audit.push(`${d.id} 첫 check 뒤 추가됨`); else if (key(o) !== key(d)) audit.push(`${d.id} 값 변경: ${JSON.stringify(o.vary)} → ${JSON.stringify(d.vary)}`); }
    for (const o of S0.directions || []) if (!P.directions.find(d => d.id === o.id)) audit.push(`${o.id} 첫 check 뒤 삭제됨`);
  } else audit.push('check 스냅샷 없음(check 미실행)');
  const files = [path.relative(ROOT, f), ...(fs.existsSync(snapF) ? [path.relative(ROOT, snapF)] : []), ...new Set(P.directions.map(d => d.signals).filter(Boolean).map(x => path.relative(ROOT, path.join(R, x))))];
  sh(`git add ${files.join(' ')}`, { cwd: ROOT });
  try { sh(`git commit -qm "${step} pre-registration: ${P.directions.length} directions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, { cwd: ROOT }); } catch { /* already committed */ }
  const all = P.directions.flatMap(d => configs(step, d));
  const ex = path.join(R, 'steps', `${step}-extra.json`); fs.writeFileSync(ex, JSON.stringify(all.map(strip)));
  const so = sh(`node lib/screen.js --step ${step} --extra steps/${step}-extra.json --fam none --top 0 2>/dev/null`, { timeout: 1800000 });
  const out = path.join(R, so.match(/전체 결과: (\S+)/)[1]);
  const C = require('./core.js');
  const rows = fs.readFileSync(out, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(r => r.overall);
  const md = [`# ${step} ${P.goal || ''}`, '', `- 계획(사전 등록, 채점 전 커밋): \`steps/${step}-plan.json\` · 스크린: \`${path.relative(R, out)}\` · 배터리: \`steps/${step}-battery.md\``, '',
    '| 방향 | 행동 유형 | 내용 | 근거 | 반증 예측 |', '|---|---|---|---|---|', ...P.directions.map(d => `| ${d.id} | ${d.type} | ${d.title} | ${d.why} | ${d.predict} |`), '', '## 스크린 (점수 | 세트별 Δ중앙/Δ최악 %p | 사례 최악 | 이탈)', '```'];
  const dig = [`${step} 스크린 ${rows.length}개 설정 · 방향 ${P.directions.length}개` + (audit.length ? `\n사전 등록 감사: ${audit.join(' · ')}${P.changes ? ` (사유: ${P.changes})` : ''}` : '\n사전 등록 감사: 첫 check 이후 변경 없음')]; const res = [];
  for (const d of P.directions) {
    const rs = rows.filter(r => r.cfg.fam === d.id).sort((a, b) => b.overall.score - a.overall.score);
    for (const r of rs) md.push(C.printBrief(r.name, { overall: r.overall, sets: r.sets, episodes: r.episodes || {} }).replace(/\s+$/, ''));
    if (!rs.length) { dig.push(`${d.id} ${d.type}: 결과 없음(오류)`); continue; }
    const best = rs[0], cfg = all.find(c => c.name === best.name);
    const nb = Object.assign({}, d.neighbors || {}); if (!d.neighbors) for (const [k, v] of Object.entries(cfg._g)) if (typeof v === 'number' && v !== 0) {
      const r2 = x => Number.isInteger(v) ? Math.max(1, Math.round(x)) : +x.toPrecision(3); const a = r2(v * 0.8), b = r2(v * 1.2); nb[k] = [...new Set([a, b])].filter(x => x !== v);
    }
    const jf = path.join(require('os').tmpdir(), `bat-${step}-${d.id}.json`);
    const bat = n => sh(`node lib/battery.js '${JSON.stringify(strip(cfg)).replace(/'/g, "'\\''")}' --step ${step} --dir ${d.id} --md steps/${step}-battery.md --json ${jf} --quiet` + (P.k2 ? ` --k2 ${P.k2}` : '') + (n ? ` --neighbors '${JSON.stringify(n)}'` : ''), { timeout: 600000 });
    let nbErr = false;
    try { bat(Object.keys(nb).length ? nb : null); } catch (e) { nbErr = true; bat(null); } // e.g. a discrete parameter without that neighbour value
    const B = JSON.parse(fs.readFileSync(jf)); if (nbErr) { B.gates.A4 = false; B.pass = false; B.hold = false; } res.push([d, B]);
    const g = B.gates, m = v => v === null ? '–' : v ? 'O' : 'X';
    dig.push(`${d.id} ${d.type} · ${d.title}: 최고 ${best.overall.score.toFixed(2)} (${best.name.split('·').slice(1).join('·') || '단일'}), 양수 ${rs.filter(r => r.overall.score > 0).length}/${rs.length}`);
    dig.push(`  배터리 A1${m(g.A1)} A2${m(g.A2)} A3${m(g.A3)} A4${m(g.A4)} A5${m(g.A5)} A7${m(g.A7)} A10${m(g.A10)} · 시도 ${B.trials}(×${B.k2}) · 플라시보 ${B.placebo == null ? '–' : Math.round(B.placebo * 100) + '%'} · 상위연도 ${B.years.map(y => y.join(' ')).join(', ')} · 상위2년 제외 ${B.exTop2 >= 0 ? '+' : ''}${B.exTop2} → ${B.pass ? '숫자 통과' : B.hold ? '보류 후보' : '미달'}${nbErr ? ' (이웃값 실행 불가 → A4 실패, 계획에 neighbors 지정 필요)' : ''}`);
  }
  md.push('```');
  const flagged = res.filter(([, B]) => B.pass || B.hold);
  const gate = flagged.length ? `검토 필요: ${flagged.map(([d, B]) => `${d.id}(${B.pass ? '통과' : '보류 후보'})`).join(', ')} → 비평가·결재자` : '자동 기각: 숫자 기준을 통과하거나 보류 조건에 든 방향 없음 → 비평·결재 생략';
  dig.push('게이트: ' + gate);
  md.push('', '## 사전 등록 감사', audit.length ? audit.map(x => '- ' + x).join('\n') + (P.changes ? `\n- 사유: ${P.changes}` : '') : '- 첫 check 이후 변경 없음');
  md.push('', '## 자동 판정 요약', '```', ...dig.slice(1), '```', '');
  fs.writeFileSync(path.join(R, 'steps', `${step}.md`), md.join('\n') + '\n');
  console.log(dig.join('\n'));
  // commit the run outputs so the tree stays clean while the review runs
  sh('git add -A', { cwd: ROOT });
  try { sh(`git commit -qm "${step} run: screen, batteries, step doc" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, { cwd: ROOT }); } catch { }
  try { sh('git pull -q --rebase && git push -q', { cwd: ROOT, timeout: 180000 }); } catch (e) { console.log('푸시 실패: ' + String(e.stderr || e).slice(0, 120)); }
}

else if (cmd === 'close') {
  const { P } = loadPlan(step), verdict = opt('--verdict'), why = opt('--why', '');
  if (!verdict) { console.error('--verdict 필요'); process.exit(1); }
  const sd = path.join(R, 'steps', `${step}.md`);
  fs.appendFileSync(sd, `## 결론\n\n**${verdict}** — ${why}\n`);
  const lf = path.join(R, 'LEDGER.md'), L = fs.readFileSync(lf, 'utf8').split('\n');
  const row = `| ${step} | ${P.goal} (${P.directions.map(d => `${d.id} ${d.title}`).join(' / ')}) | ${verdict} | ${why} |`;
  const same = L.findIndex(l => l.startsWith(`| ${step} |`));
  if (same >= 0) L[same] = row; // close again = replace, not a second row
  else L.splice(L.map((l, i) => /^\| S\d+ /.test(l) ? i : -1).filter(i => i >= 0).pop() + 1, 0, row);
  fs.writeFileSync(lf, L.join('\n'));
  if (opt('--ideas')) {
    const If = path.join(R, 'IDEAS.md'); let I = fs.readFileSync(If, 'utf8');
    for (const u of JSON.parse(opt('--ideas'))) {
      // keep the row's history: append to "tested", replace "result" and "gap" (a new row goes after the last table row)
      const re = new RegExp(`^\\| ${u.row} \\|(.*)$`, 'm'), m = I.match(re);
      if (m) { const c = m[1].split('|').map(x => x.trim()); const t = c[0].includes(u.tested) ? c[0] : `${c[0]}, ${u.tested}`; I = I.replace(re, `| ${u.row} | ${t} | ${u.result} | ${u.gap} |`); }
      else I = I.replace(/(\| 매수 타이밍만 \|.*\n)/, `$1| ${u.row} | ${u.tested} | ${u.result} | ${u.gap} |\n`);
    }
    fs.writeFileSync(If, I);
  }
  sh('node lib/brief.js', {});
  const trailer = `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + (opt('--session') ? `\nClaude-Session: ${opt('--session')}` : '') + '"';
  sh('git add -A', { cwd: ROOT });
  try { sh(`git commit -qm "${step} ${verdict}: ${P.goal.replace(/"/g, "'").slice(0, 60)}" ${trailer}`, { cwd: ROOT }); } catch { }
  try { sh('git pull -q --rebase && git push -q', { cwd: ROOT, timeout: 180000 }); console.log(`${step} 기록·푸시 완료`); } catch (e) { console.log('푸시 실패: ' + String(e.stderr || e).slice(0, 160)); }
}
else if (cmd === 'criteria') console.log(require('./brief.js').criteria());
else console.log('usage: node lib/step.js prep | check Sxx | run Sxx | close Sxx --verdict ... --why ... | criteria');
