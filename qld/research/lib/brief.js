#!/usr/bin/env node
// Writes BRIEF.md: the ONE file a research agent reads (target < 3k tokens).
// It replaces reading PROTOCOL/README/LEDGER/engine.js separately. Also prints catalog coverage.
// usage: node lib/brief.js [--step S09 --goal "..."]
// The adoption criteria live only in PROTOCOL.md; criteria() extracts them (also used by `step.js criteria`).
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const section = (md, title) => ((md.split(`\n## ${title}`)[1] || '').split('\n## ')[0] || '').replace(/^[^\n]*\n/, '').trim();
function criteria() {
  const P = fs.readFileSync(path.join(R, 'PROTOCOL.md'), 'utf8');
  return ['## 채택 기준표', section(P, '채택 기준표'), '', '## 과최적화를 피하는 습관', section(P, '과최적화를 피하는 습관')].join('\n');
}
module.exports = { criteria };
if (require.main === module) {
const { CATALOG } = require('./catalog.js');
const { opt } = require('./args.js')({ step: 'string', goal: 'string' });

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
const champSec = section(ledger, '현재 챔피언');
// 같은 스텝이 두 줄이면 마지막 줄만. 최근 3스텝은 전문, 그 이전은 목표를 줄여 싣는다(시험 내용과 점수는 아래 행동 유형표에 있다).
const rowMap = new Map();
for (const r of (ledger.match(/^\| S\d+ \|.*$/gm) || [])) { const c = r.split('|').map(x => x.trim()); rowMap.set(c[1], c); }
const rowList = [...rowMap.values()];
const cut = (t, n) => t.length > n ? t.slice(0, n).trimEnd() + '…' : t;
const stepRows = rowList.map((c, i) => `- ${c[1]}: ${i >= rowList.length - 3 ? c[2] : cut(c[2], 45)} → ${c[3]}`);
const ideas = fs.existsSync(path.join(R, 'IDEAS.md')) ? fs.readFileSync(path.join(R, 'IDEAS.md'), 'utf8') : '';
const backlog = (ideas.split('## 아직 안 해 본 아이디어')[1] || '').trim();
const ideaMap = ((ideas.split('## 행동 유형별 커버리지')[1] || '').split('\n## ')[0] || '').trim();

const fams = {};
for (const [k, fam] of CATALOG) (fams[fam] = fams[fam] || []).push(k + (best[k] ? `(${best[k].score.toFixed(1)})` : '(미시험)'));
const top = Object.entries(best).sort((a, b) => b[1].score - a[1].score).slice(0, 8).map(([k, v]) => `${v.name} ${v.score.toFixed(2)} [${v.step}]`);

const B = `# BRIEF (자동 생성: node lib/brief.js) — 연구 에이전트는 이 파일만 읽고 시작한다
${opt('step') ? `\n## 이번 스텝\n${opt('step')}: ${opt('goal', '')}\n` : ''}
## 현재 챔피언
${champSec}

## 지난 스텝 결론 (다시 시험하려면 새 근거 필요)
${stepRows.join('\n')}

## 도구 (qld/research 에서 실행) — 작업 규칙은 전략가 정의에 있다. 여기는 형식과 훅 설명만
- 계획 형식: steps/Sxx-plan.json = {"step","goal","directions":[{"id":"A","type","title","why","predict","signals","params","vary":{"키":[값,…]},"neighbors"?}],"changes"?}
- 신호 모듈: \`module.exports = (D, p, H, L) => ({ extraVoteExit | extraVote | extraExit | reentryBlock | exitSig/enterSig })\` 0/1 배열, 인덱스 j는 j일 종가까지만 사용. 엔진이 j+1일 종가에 매매
  - extraVoteExit: 이탈 표에만 +1 · extraVote: 이탈·복귀 모두 +1 (복귀 엄격) · extraExit: 켜진 날 이탈 · reentryBlock: 켜진 동안 복귀 금지 · exitSig/enterSig + params.rule "sig": 챔피언 대체(챔피언 위에 얹는 후보는 candidates/champ_v2.js의 run(D, {훅}) = 최종 전략 v2 복제, 훅은 S09_lib와 같음) · slowSig: 보유 중 켜진 동안 QLD 대신 QQQ(1배) 보유 (S11) · boostSig: 보유 중 켜진 동안 QLD 대신 합성 3배 보유(적립금도 3배, 이탈 때 함께 매도; params.boostName 로그 이름, S16) · qldTarget: 보유 중 QLD 목표 비중 0~1(나머지 SGOV, 목표가 바뀔 때만 매매, 적립금도 그 비중; params.targetName 로그 이름, S18) · contribSig: 이탈 중 켜진 날 적립금으로 QLD 매수(꺼진 날은 contribOut 규칙, S22) · pauseSig: 보유 중 켜진 동안 새 적립금을 SGOV에 쌓고, 꺼진 첫날 쌓인 현금을 QLD에 투입(보유분은 안 팜; params.pauseName 로그 이름, S22)
  - 카탈로그 지표 재사용: \`require('../lib/catalog.js').zOf(D, key)\` → {raw, z} (발표 시차·z점수 적용됨). 새 지표는 catalog.js에 한 줄 추가(가족, 시작연도, 근거, 시차)
  - 원자료: \`require('../lib/macro.js').series(D, 'FRED이름 또는 Y_이름', 발표시차일)\`. 시차: 일간 1, 주간 5~6, 월간 CPI/PPI 50, 실업률 40, M2 55. 같은 시각 종가 비율은 0
  - D: px(지수), lx(QLD), ma[20|50|100|200], vols.{rv20,down20,up20,rv10}, v60, r10, rsiw(주봉 RSI), ms(매크로 경보 비율), vix(없을 수 있음), day(1970년 기준 일수) · H·L: QLD 고가·저가
  - 추가형 훅은 params에 "strategy":true를 두고 rule은 생략(=final), extraName으로 로그 이름
- 엔진의 다른 구조: rule "kelly"(변동성 비례 노출, sizing steps/kelly, maxLev), rule "vol"(이전 방어형), parkQQQ(이탈 시 QQQ로 감속)
- 챔피언 행동 파라미터 (기본값이면 챔피언과 동일): fExit1(일반 이탈 때 파는 비율, 강신호 때 나머지), fCore(이탈해도 남기는 코어 비율), contribOut(이탈 중에도 QLD로 사는 적립금 비율), ddRe(252일 고점 대비 낙폭 이상 + 20일선 위면 역발상 복귀), maxOut(이탈 N거래일 경과 + 20일선 위면 복귀), slowMA·slowBand(보유 중 지수가 N일선 −band 아래면 QLD 대신 QQQ 1배로 감속, +band 위면 QLD 복귀; 훅 slowSig 0/1 배열로 직접 지정 가능, slowName 로그 이름), capQ(보유 중 QLD 비중 상한, 매월 첫 거래일 리밸런싱·나머지 SGOV; 0=끔), parkMacro(매크로 경보 단독 이탈 때만 매도대금 중 이 비율을 QQQ로 대기; 0=끔), votes·strongVotes·hold·reMaxVotes·dnHi·upHi·crash·rsiW·expand·macroTh
- 세금 파라미터: lossHarvest(연말 과세 차익이 공제 한도를 넘으면 손실 난 오래된 매수분을 선입선출로 팔아 한도까지 상계 후 재매수, T12, 기본 꺼짐)

${criteria().replace(/^## /gm, '### ').replace('### 채택 기준표', '## 채택 기준 (PROTOCOL.md에서 자동 추출, 자동 판정은 battery.js)')}

## 카탈로그 커버리지 (가족: 지표(최고 점수))
${Object.entries(fams).map(([f, ks]) => `- ${f}: ${ks.join(' ')}`).join('\n')}

상위 시험 결과: ${top.join(' · ')}

## 행동 유형별 커버리지 (IDEAS.md, 시험한 것 · 결론 · 빈칸)
${ideaMap}

## 아직 안 해 본 아이디어 (IDEAS.md)
${backlog.slice(0, 2500)}
`;
fs.writeFileSync(path.join(R, 'BRIEF.md'), B);
console.log(`BRIEF.md ${B.length}자 (~${Math.round(B.length / 2.2)} 토큰 추정)`);
}
