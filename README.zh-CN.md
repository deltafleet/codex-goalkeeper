# Goalkeeper

长时间 agent 任务通常不是突然失败的。

它们会慢慢偏离方向。

Agent 仍然会显得很自信。测试仍然会运行。计划看起来也仍然合理。但经过多次 compaction、handoff 和 resume 之后，最重要的东西可能会悄悄变模糊：

> 我们为什么要按这个方向做？

Goalkeeper 是一个很小的 skill，用来帮助 Claude Code、Codex 以及其他 skill-compatible coding agents 在长时间 `/goal` 工作中跨越 compaction、resume 和 handoff 仍然保持方向。

它不添加隐藏的记忆引擎。它给 agent 一个可持续的工作习惯：

- 保持一个简短 checkpoint
- 保持一个更丰富的 context pack
- 把决策和验证写入 event log
- 在容易发生 drift 的边界之后，继续前先读 checkpoint

无聊的文件。更好的连续性。

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md)

## 安装

```bash
npx skills add deltafleet/goalkeeper
```

如果要明确指定 agent：

```bash
npx skills add deltafleet/goalkeeper --agent claude-code codex
```

要求: Node.js 18+ 和 `npx`。在长 goal workflow 中，agent 会使用 skill 内置的 Node helper scripts。

当请求和 metadata 高度匹配时，Skill-compatible agent 可以自动加载已安装的 skill。Goalkeeper 的 metadata 面向 `/goal`、长时间任务、compaction、resume、handoff 和 continuity preservation。

所以像下面这样的 goal 可能已经足够触发它：

> `/goal` Harden this release over a long-running session. Use goalkeeper.

但 skill activation 仍然是 routing decision，不是私有的 agent runtime hook。Goalkeeper 不能强制自己附着到每一个 goal。

对于重要的长期任务，最稳妥的做法是在创建 goal 时，或创建 goal 后正式开始工作前，明确调用它：

> Use goalkeeper for this goal.

用户需要记住的句子到这里就够了。checkpoint、context pack、event log、失败尝试、验证状态和 helper scripts，都由 agent 在 Goalkeeper workflow 中处理。

## 问题

对于短任务，compaction 通常只是细节。Agent 大多能恢复。

但长 goal 不一样。

想象一个真实会话：

1. 你让 agent 修一个支付 bug。
2. 早期调查发现，`refunds` 相关代码是 legacy，不能轻易动。
3. 最快的 patch 是直接改 `refunds`，所以你明确拒绝这条路。
4. agent 尝试把修复放到 webhook handler，但 duplicate event 场景会失败。
5. 最后它验证了安全路线：在 service layer 加 idempotency guard，并用 regression test 覆盖。
6. 测试通过了。这条路线现在是需要保留下来的安全路线。
7. 上下文被 compact。
8. 后来 agent 带着整洁摘要回来：“支付 bug 基本修好了。”
9. 它还记得 goal，但可能不再清楚 `refunds` 为什么不能动，webhook 尝试为什么失败，以及 service-layer test 为什么证明了正确路线。

drift 就从这里开始。

失败原因不是“模型忘掉了一切”。这更难处理：它记得足够继续工作，但不记得足够沿着同一个方向继续。

你会在这些情况里看到它：

- 重新打开用户已经拒绝的方案
- 因为失败原因在摘要里消失，重复同样的尝试
- 把未验证的假设当作确定事实
- 在长 handoff 后丢失准确的 next action
- 还记得 goal，但丢掉了操作约束
- 解释很流畅，但已经不匹配实际工作流

Goalkeeper 解决的是这个空隙：goal 还在，但会话的方向感已经变弱。

## Agent 会做什么

skill 激活后，agent 会在项目内维护一个连续性文件夹：

```text
.goalkeeper/
  active-session
  sessions/
    <goal-session-id>/
      checkpoint.md
      context-pack.md
      events.jsonl
```

每个文件的职责不同：

- `checkpoint.md`: 恢复时首先读取的简短状态
- `context-pack.md`: 对 checkpoint 来说太长、但 compaction 后仍应保留的推理链
- `events.jsonl`: 决策、失败尝试、命令证据、验证、风险和 handoff 记录

active goal 说明目的地。Goalkeeper 保存为什么这条路线仍然正确。

## 工作原理

Goalkeeper 把长时间 agent 工作变成一个简单循环：

```text
长 /goal 开始
  -> agent 创建或恢复 Goalkeeper session
  -> 记录重要约束和决策
  -> 保留失败尝试，避免重复犯错
  -> 在信心变化时记录验证证据
  -> 在有意义的边界刷新 checkpoint.md
  -> context-pack.md 保存更深的推理链
  -> resume、handoff 或怀疑 compaction 后，agent 先读 checkpoint.md
  -> 如果 checkpoint 太薄，agent 再读 context-pack.md
  -> 如果需要精确证据，agent 检查 events.jsonl 或 source files
```

这不是保存对话 transcript。它保存的是工作状态。

## 为什么故意做得很小

把这个项目做大很容易：

- daemon
- database
- session rewriter
- private runtime hook
- vector memory layer
- full transcript engine

Goalkeeper 故意避开这些。

它使用文件，因为文件可见、可审查、可移动，并且 compaction 后 agent 容易重新读取。目标不是让 agent 全知全能。目标是让下一轮从正确状态开始。

## 它不是什么

- 不是 Codex 或 Claude Code plugin。
- 不是 MCP server。
- 不是 database。
- 不是完整对话 transcript 仓库。
- 不是 private agent runtime hook。
- 不保证完美记忆。
- 不会降低 compaction 频率。

Goalkeeper 改善连续性。它不假装消除上下文限制。

## 改善什么

使用 Goalkeeper 后，恢复的会话更有机会找回：

- 用户的 non-negotiable constraints
- 当前实现方向
- 被拒绝的替代方案为什么仍然应被拒绝
- 改变信心的测试或命令
- 真实的 next action
- 不应该被轻描淡写带过的 unresolved risks

长时间 agent 工作里很多无聊但昂贵的失败，只靠这些就能减少。

## Repository Layout

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

For repository maintainers:

```bash
npm run validate
```

Equivalent manual checks:

```bash
find src/goalkeeper/scripts tests -name '*.mjs' -print0 | xargs -0 -n1 node --check
node tests/test-goalkeeper-update-checkpoint.mjs
npx skills add . --list
```

## Versioning

Goalkeeper uses SemVer.

- Patch: docs, examples, tests, and compatible bug fixes
- Minor: new compatible helpers or workflow fields
- Major: breaking changes to checkpoint, event, or script contracts

See [docs/RELEASE.md](docs/RELEASE.md) for release steps.

## Contributing

Issues and PRs are welcome. The project bias is strict:

- keep the core workflow small
- do not add hidden runtime dependencies
- do not promise perfect recovery
- prefer project-local files over global state
- prove changes with the validation commands above

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

MIT. See [LICENSE](LICENSE).
