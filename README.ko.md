# Goalkeeper

긴 agent 작업은 보통 한 번에 망가지지 않습니다.

조금씩 방향을 잃습니다.

에이전트는 여전히 자신 있게 말합니다. 테스트도 돌립니다. 계획도 그럴듯해 보입니다. 그런데 compact, handoff, resume이 반복된 뒤에는 가장 중요한 감각이 조용히 흐려질 수 있습니다.

> 우리가 왜 이 방향으로 가고 있었지?

Goalkeeper는 긴 `/goal` 작업이 compact, resume, handoff를 지나도 방향을 잃지 않도록 돕는 작은 skill입니다.

숨겨진 메모리 엔진을 추가하지 않습니다. 대신 에이전트에게 지속 가능한 작업 습관을 줍니다.

- 짧은 checkpoint를 유지한다
- 더 풍부한 context pack을 유지한다
- 결정과 검증을 event log에 남긴다
- drift가 생기기 쉬운 경계 이후에는 계속하기 전에 checkpoint를 먼저 읽는다

지루한 파일들. 더 나은 연속성.

[English](README.md) | [日本語](README.ja.md) | [中文](README.zh-CN.md)

## 설치

```bash
npx skills add deltafleet/goalkeeper
```

특정 agent를 명시하려면 다음처럼 설치할 수 있습니다.

```bash
npx skills add deltafleet/goalkeeper --agent claude-code codex
```

요구사항: Node.js 18+와 `npx`. 긴 goal workflow에서 agent가 skill에 포함된 Node helper script를 사용합니다.

Skill-compatible agent는 설치된 skill 중 요청과 관련성이 높은 skill을 자동으로 불러올 수 있습니다. Goalkeeper의 metadata는 `/goal`, 긴 작업, compact, resume, handoff, continuity 보존 신호에 반응하도록 작성되어 있습니다.

그래서 아래처럼 goal 자체가 충분히 분명하면 자동으로 붙을 수 있습니다.

> `/goal` 이번 릴리스를 장기 세션으로 안정화해줘. goalkeeper를 사용해줘.

하지만 skill 활성화는 agent runtime hook이 아니라 routing 판단입니다. Goalkeeper가 모든 goal에 자신을 강제로 붙일 수는 없습니다.

중요한 장기 작업이라면 goal을 만들 때, 또는 goal을 만든 직후 본격 작업 전에 명시적으로 호출하는 편이 가장 안전합니다.

> 이 goal에는 goalkeeper를 사용해줘.

사용자가 기억할 문장은 여기까지입니다. checkpoint, context pack, event log, 실패한 시도, 검증 상태, helper script 같은 것은 Goalkeeper workflow 안에서 agent가 관리합니다.

## 문제

짧은 작업에서 compact는 대개 큰 문제가 아닙니다. 에이전트가 대충 복구할 수 있습니다.

하지만 긴 goal은 다릅니다.

실제 세션을 상상해보면 이렇습니다.

1. agent에게 결제 버그 수정을 맡깁니다.
2. 초반 조사에서 `refunds` 쪽 코드는 레거시라 건드리면 안 된다는 사실이 드러납니다.
3. 가장 빠른 patch는 `refunds`를 직접 고치는 방식이라, 사용자가 그 경로를 명시적으로 거부합니다.
4. agent는 webhook handler 쪽으로 옮겨보지만, duplicate event 케이스에서 실패합니다.
5. 결국 service layer에 idempotency guard를 두고 regression test로 막는 경로를 검증합니다.
6. 테스트가 통과합니다. 이제 이 경로가 유지되어야 하는 안전한 경로입니다.
7. 컨텍스트가 compact됩니다.
8. 나중에 에이전트는 “결제 버그는 거의 해결됨” 같은 깔끔한 요약으로 돌아옵니다.
9. goal은 기억하지만, `refunds`를 건드리면 안 된다는 점, webhook 시도가 실패했다는 점, service-layer test가 안전한 경로를 증명했다는 점은 희미해질 수 있습니다.

여기서 drift가 시작됩니다.

실패 원인은 “모델이 전부 잊었다”가 아닙니다. 더 까다롭습니다. 계속할 만큼은 기억하지만, 같은 방향으로 계속할 만큼은 기억하지 못합니다.

이런 순간에 드러납니다.

- 사용자가 이미 거부한 접근을 다시 연다
- 실패 이유가 요약에서 사라져 같은 시도를 반복한다
- 검증되지 않은 가정을 확정 사실처럼 다룬다
- 긴 handoff 뒤에 정확한 next action을 잃는다
- goal은 유지하지만 운영 제약을 잃는다
- 설명은 매끄럽지만 실제 작업 흐름과 어긋난다

Goalkeeper는 “goal은 남아 있지만 세션의 방향 감각은 약해진” 그 틈을 메우기 위한 도구입니다.

## Agent가 하는 일

skill이 활성화되면 agent는 프로젝트 안에 연속성 폴더를 유지합니다.

```text
.goalkeeper/
  active-session
  sessions/
    <goal-session-id>/
      checkpoint.md
      context-pack.md
      events.jsonl
```

각 파일의 역할은 다릅니다.

- `checkpoint.md`: 다시 시작할 때 먼저 읽는 짧은 복구 상태
- `context-pack.md`: checkpoint에는 너무 길지만 compact 이후에도 살아남아야 하는 판단 근거
- `events.jsonl`: 결정, 실패한 시도, 명령 근거, 검증, 리스크, handoff 기록

active goal이 목적지를 말한다면, Goalkeeper는 왜 이 경로가 아직 맞는지를 보존합니다.

## 동작 원리

Goalkeeper는 긴 에이전트 작업을 단순한 루프로 바꿉니다.

```text
긴 /goal이 시작된다
  -> agent가 Goalkeeper 세션을 만들거나 재개한다
  -> 중요한 제약과 결정을 기록한다
  -> 실패한 시도를 남겨 같은 삽질을 반복하지 않게 한다
  -> 신뢰도가 바뀌는 검증 근거를 남긴다
  -> 의미 있는 경계마다 checkpoint.md를 갱신한다
  -> context-pack.md가 더 깊은 판단 근거를 보존한다
  -> resume, handoff, compact 의심 이후 agent는 checkpoint.md를 먼저 읽는다
  -> checkpoint가 얇으면 context-pack.md를 읽는다
  -> 정확한 증거가 필요하면 events.jsonl이나 source file을 확인한다
  -> goal이 끝나면 agent가 Goalkeeper 세션을 닫는다
  -> 이후 관련 없는 일반 질문에는 Goalkeeper recovery가 붙지 않는다
```

이것은 대화 transcript 저장이 아닙니다. 작업 상태 보존입니다.

Goalkeeper가 영원히 붙어 있으면 안 됩니다. 관리하던 goal이 끝나면 agent가 최종 결과를 기록하고, checkpoint를 closed 상태로 표시하고, active session pointer를 제거한 뒤 완료 보고를 합니다.

## 일부러 작게 만들었습니다

이 프로젝트를 크게 만드는 방법은 쉽습니다.

- daemon
- database
- session rewriter
- private runtime hook
- vector memory layer
- full transcript engine

Goalkeeper는 의도적으로 그 방향을 피합니다.

파일을 쓰는 이유는 파일이 보이고, 검토 가능하고, 옮기기 쉽고, compact 이후에도 에이전트가 다시 읽기 쉽기 때문입니다. 목표는 agent를 전지전능하게 만드는 것이 아닙니다. 다음 turn이 올바른 상태에서 시작하게 만드는 것입니다.

## 이것이 아닌 것

- Codex 또는 Claude Code plugin이 아닙니다.
- MCP server가 아닙니다.
- 데이터베이스가 아닙니다.
- 전체 대화 transcript 저장소가 아닙니다.
- private agent runtime hook이 아닙니다.
- 완벽한 기억을 보장하지 않습니다.
- compact 빈도를 줄이지 않습니다.

Goalkeeper는 연속성을 개선합니다. 컨텍스트 한계를 없애는 척하지 않습니다.

## 좋아지는 것

Goalkeeper를 쓰면 resume된 세션이 다음을 복구할 가능성이 높아집니다.

- 사용자의 non-negotiable constraints
- 현재 구현 방향
- 거부된 대안이 왜 여전히 거부되어야 하는지
- 신뢰도를 바꾼 테스트나 명령
- 실제 next action
- 대충 넘기면 안 되는 unresolved risks

긴 에이전트 작업에서 발생하는 지루하고 비싼 실패 상당수는 이 정도만으로도 줄어듭니다.

## 저장소 구조

```text
src/goalkeeper/       # installable skill payload
  SKILL.md
  agents/openai.yaml
  scripts/
  templates/
  references/
tests/                      # maintainer tests
examples/goalkeeper-session # static example state
docs/                       # roadmap and release policy
```

## Maintainer Validation

저장소 maintainer용 검증입니다.

```bash
npm run validate
```

수동으로는 다음을 실행합니다.

```bash
find src/goalkeeper/scripts tests -name '*.mjs' -print0 | xargs -0 -n1 node --check
node tests/test-goalkeeper-update-checkpoint.mjs
npx skills add . --list
```

## 버전 관리

Goalkeeper는 SemVer를 사용합니다.

- Patch: 문서, 예제, 테스트, 호환 가능한 버그 수정
- Minor: 호환 가능한 helper 또는 workflow field 추가
- Major: checkpoint, event, script contract의 breaking change

릴리스 절차는 [docs/RELEASE.md](docs/RELEASE.md)를 참고하세요.

## 기여

Issue와 PR은 환영합니다. 단, 프로젝트의 기준은 엄격합니다.

- core workflow는 작게 유지한다
- 숨겨진 runtime dependency를 추가하지 않는다
- 완벽한 복구를 약속하지 않는다
- global state보다 project-local file을 우선한다
- 변경사항은 검증 명령으로 증명한다

자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)를 참고하세요.

## 라이선스

MIT. [LICENSE](LICENSE)를 참고하세요.
