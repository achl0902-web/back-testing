#!/usr/bin/env node
// Writes BRIEF.md: the ONE file a research agent reads (target < 3k tokens).
// It replaces reading PROTOCOL/README/LEDGER/engine.js separately. Also prints catalog coverage.
// usage: node lib/brief.js [--step S09 --goal "..."]
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const { CATALOG } = require('./catalog.js');
const args = process.argv.slice(2);
const opt = (f, d) => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : d; };

// coverage from all screen files
const best = {}; const tested = {};
for (const f of fs.readdirSync(path.join(R, 'steps')).filter(f => f.endsWith('-screen.jsonl'))) {
  for (const l of fs.readFileSync(path.join(R, 'steps', f), 'utf8').trim().split('\n')) {
    if (!l) continue; const r = JSON.parse(l); if (!r.cfg || !r.overall) continue;
    const p = r.cfg.params || {}; const key = p.ind ? (p.ind2 ? `${p.ind}&${p.ind2}` : p.ind) : r.cfg.name;
    tested[key] = tested[key] || new Set(); tested[key].add(p.hook || 'struct');
    if (!best[key] || r.overall.score > best[key].score) best[key] = { score: r.overall.score, name: r.cfg.name, step: f.replace('-screen.jsonl', '') };
  }
}
const ledger = fs.readFileSync(path.join(R, 'LEDGER.md'), 'utf8');
const champSec = ledger.split('## 스텝 기록')[0].replace('# 연구 기록', '').trim();
const stepRows = (ledger.match(/^\| S\d+ \|.*$/gm) || []).map(r => { const c = r.split('|').map(x => x.trim()); return `- ${c[1]}: ${c[2]} → ${c[3]}`; });
const ideas = fs.existsSync(path.join(R, 'IDEAS.md')) ? fs.readFileSync(path.join(R, 'IDEAS.md'), 'utf8') : '';
const backlog = (ideas.split('## 아직 안 해 본 아이디어')[1] || '').trim();

const fams = {};
for (const [k, fam] of CATALOG) (fams[fam] = fams[fam] || []).push(k + (best[k] ? `(${best[k].score.toFixed(1)})` : '(미시험)'));
const top = Object.entries(best).sort((a, b) => b[1].score - a[1].score).slice(0, 8).map(([k, v]) => `${v.name} ${v.score.toFixed(2)} [${v.step}]`);

const B = `# BRIEF (자동 생성: node lib/brief.js) — 연구 에이전트는 이 파일만 읽고 시작한다
${opt('--step') ? `\n## 이번 스텝\n${opt('--step')}: ${opt('--goal', '')}\n` : ''}
## 챔피언
${champSec}

## 지난 스텝 결론 (다시 시험하려면 새 근거 필요)
${stepRows.join('\n')}

## 도구 (qld/research 에서 실행, 출력은 짧게)
- 후보 1개: \`node lib/score.js '<cfg>' --brief\` (1~2초). cfg = {"name","step","by","signals":"candidates/x.js","params":{"strategy":true,...}}
- 넓은 스크린: \`node lib/screen.js --step Sxx [--fam a,b] [--extra ideas.json]\` (카탈로그 × 훅 × z, 약 5분, 토큰 0). 두 지표 조합: \`--pairs steps/Sxx-screen.jsonl\`
- 결선 검증: \`node lib/battery.js '<cfg>' --step Sxx --md steps/Sxx-battery.md\` (이웃값·비용2배·7월시작·1억거치·플라시보·연도기여·결정적 매매·자동판정, 약 30초)
- 브리프 출력 한 줄 형식: 점수 | 세트별 챔피언 대비 Δ중앙/Δ최악 %p | 사례 최악 | 이탈수 | 이름. 점수 = min(발견세트 N10·N5, 확인세트 N10oos·S10·S5)의 평균(Δ중앙+0.5Δ최악)
- 신호 모듈: \`module.exports = (D, p, H, L) => ({ extraVoteExit | extraVote | extraExit | reentryBlock | exitSig/enterSig })\` 0/1 배열, 인덱스 j는 j일 종가까지만 사용. 엔진이 j+1일 종가에 매매
  - extraVoteExit: 이탈 표에만 +1 · extraVote: 이탈·복귀 모두 +1 (복귀 엄격) · extraExit: 켜진 날 이탈 · reentryBlock: 켜진 동안 복귀 금지 · exitSig/enterSig + params.rule "sig": 챔피언 대체
  - 카탈로그 지표 재사용: \`require('../lib/catalog.js').zOf(D, key)\` → {raw, z} (발표 시차·z점수 적용됨). 새 지표는 catalog.js에 한 줄 추가(가족, 시작연도, 근거, 시차)
  - 원자료: \`require('../lib/macro.js').series(D, 'FRED이름 또는 Y_이름', 발표시차일)\`. 시차: 일간 1, 주간 5~6, 월간 CPI/PPI 50, 실업률 40, M2 55. 같은 시각 종가 비율은 0
  - D: px(지수), lx(QLD), ma[20|50|100|200], vols.{rv20,down20,up20,rv10}, v60, r10, rsiw(주봉 RSI), ms(매크로 경보 비율), day(일수)
- 엔진의 다른 구조: rule "kelly"(변동성 비례 노출, sizing steps/kelly, maxLev), rule "vol"(이전 방어형), parkQQQ(이탈 시 QQQ로 감속)
- 챔피언 행동 파라미터 (기본값이면 챔피언과 동일): fExit1(일반 이탈 때 파는 비율, 강신호 때 나머지), fCore(이탈해도 남기는 코어 비율), contribOut(이탈 중에도 QLD로 사는 적립금 비율), ddRe(252일 고점 대비 낙폭 이상 + 20일선 위면 역발상 복귀), maxOut(이탈 N거래일 경과 + 20일선 위면 복귀), slowMA·slowBand(보유 중 지수가 N일선 −band 아래면 QLD 대신 QQQ 1배로 감속, +band 위면 QLD 복귀; 훅 slowSig 0/1 배열로 직접 지정 가능, slowName 로그 이름), votes·strongVotes·hold·reMaxVotes·dnHi·upHi·crash·rsiW·expand·macroTh

## 채택 기준 (자동 판정은 battery.js가 함)
A1 표본 밖(N10oos·S10·S5) 중앙 −1%p·최악 −2%p 이내 · A2 최악 +2%p 또는 N10·N10oos 중앙 +1%p (시도 30회 초과 시 2배) · A3 사례 6개 중 −5%p 초과 악화 없음, 4개 이상 비악화 · A4 이웃값(±20%) 유지 · A5 비용2배·7월시작 유지 · A6 새 파라미터 2개 이하, 근거 선기록 · A7 1999~ 이탈 40회 이하 · A8 미래 정보 없음 · A10 플라시보 95% 이상

## 카탈로그 커버리지 (가족: 지표(최고 점수))
${Object.entries(fams).map(([f, ks]) => `- ${f}: ${ks.join(' ')}`).join('\n')}

상위 시험 결과: ${top.join(' · ')}

## 아직 안 해 본 아이디어 (IDEAS.md)
${backlog.slice(0, 2500)}
`;
fs.writeFileSync(path.join(R, 'BRIEF.md'), B);
console.log(`BRIEF.md ${B.length}자 (~${Math.round(B.length / 2.2)} 토큰 추정)`);
