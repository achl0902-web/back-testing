# QLD 전략 연구실

여러 역할이 토론하며 QLD 적립 전략을 단계별로 개선하는 작업 공간입니다. 진행 규칙은 `PROTOCOL.md`, 지금까지의 결론과 현재 챔피언은 `LEDGER.md`에 있습니다.

| 경로 | 내용 |
|---|---|
| `PROTOCOL.md` | 역할, 스텝 진행 순서, 채택 기준표, 과최적화 방지 규칙, 보고 형식 |
| `LEDGER.md` | 현재 챔피언, 스텝별 결론, 다음 스텝 후보 |
| `champion.json` | 현재 챔피언 설정 (점수표가 자동으로 비교) |
| `steps/` | 스텝마다 사전 등록, 결과, 토론, 결재를 기록한 문서 |
| `candidates/` | 연구자가 만든 신호 모듈 (`example_ma200.js`가 양식) |
| `trials.jsonl` | 점수표를 돌릴 때마다 자동으로 쌓이는 시도 기록 (다중검정 관리) |
| `lib/score.js` | 표준 점수표: 5개 검증 세트 × DCA·챔피언 비교 + 6개 사례 구간 |
| `lib/data.js` | 데이터 로딩, 고정 검증 구간 |
| `lib/buyrules.js` | 매수 쪽 규칙·리밸런싱 시뮬레이터 (매일 현금 유입) |
| `data/` | 나스닥100(합성 QLD, 매크로 경보 포함)과 S&P 2배 데이터 |
| `refresh_data.py` | 최신 종가·매크로로 나스닥100 데이터 갱신 |

## 점수표 쓰는 법 (qld/research 에서)

```bash
# 챔피언 파라미터 하나 바꿔 보기
node lib/score.js '{"name":"RSI 40","step":"S08","by":"tech","params":{"strategy":true,"rsiW":40}}'

# 사전 등록한 값만 격자로
node lib/score.js '{"name":"하방 변동성","step":"S08","by":"tech","params":{"strategy":true}}' --grid '{"dnHi":[0.25,0.30,0.35]}'

# 직접 만든 신호 모듈 (이탈·복귀 신호 배열)
node lib/score.js '{"name":"200일선 -4%","step":"S08","by":"tech","signals":"candidates/example_ma200.js","params":{"rule":"sig","band":0.04}}'

# 레드팀 스트레스: 비용 2배, 7월 시작 구간
node lib/score.js '{"name":"...","costMult":2,"startMonth":7,"params":{...}}'

# 매수 쪽 규칙 / 리밸런싱
node lib/score.js '{"name":"섀넌 50","sim":"buy","params":{"mode":"shannon","w":0.5,"reb":"quarterly"}}'

# 1억 거치식
node lib/score.js '{"name":"...","money":{"lump":100000000},"params":{"strategy":true}}'
```

신호 모듈이 돌려줄 수 있는 배열 (신호일 j 기준, 0/1):

- `exitSig`, `enterSig`: 챔피언을 **대체**하는 이탈·복귀 규칙 (`params.rule`을 `"sig"`로)
- `extraVote`: 챔피언에 다섯 번째 축으로 **추가** (켜진 축 수에 더해짐)
- `extraExit`: 챔피언에 추가 이탈 경보 (매크로 경보처럼 켜진 날 이탈)
- `reentryBlock`: 켜져 있는 동안 챔피언의 복귀를 막음
- 추가형은 `params`에 `"strategy":true`를 두고 `rule`은 생략(=final). `extraName`으로 로그 이름 지정

신호 모듈에서 쓸 수 있는 값: `D.px`(나스닥100), `D.lx`(QLD), `D.ma[20|50|100|200]`, `D.vols.{rv20,down20,up20,rv10}`, `D.v60`, `D.r10`, `D.rsiw`(주봉 RSI), `D.ms`(매크로 경보 비율), `D.vix`(없을 수 있음), `D.day`(1970년 기준 일수), 인자로 받는 `H`, `L`(QLD 고가·저가). 새 매크로 지표는 `lib/macro.js`의 `series(D, 이름, 발표시차일)`로 불러 쓰세요. `../data/macro/`의 원자료를 지표별 발표 시차만큼 늦춰서 써야 합니다(`../scripts/macro.py` 참고).
