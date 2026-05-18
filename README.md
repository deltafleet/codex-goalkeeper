# Goalkeeper

Long agent runs do not usually fail all at once.

They drift.

The agent still sounds confident. The tests still run. The plan still looks plausible. But after enough compaction, handoffs, and resumed turns, the session can quietly forget the thing that mattered most:

> Why were we doing it this way?

Goalkeeper is a small Agent Skill that helps Claude Code, Codex, and other skill-compatible coding agents keep long-running `/goal` work oriented across compaction, resumes, and handoffs.

It does not add a hidden memory engine. It gives the agent a durable working ritual:

- keep a short checkpoint
- keep a richer context pack
- append decisions and verification to an event log
- read the checkpoint before continuing after drift-prone boundaries

Boring files. Better continuity.

[한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh-CN.md)

## Install

```bash
npx skills add deltafleet/goalkeeper
```

To target specific agents explicitly:

```bash
npx skills add deltafleet/goalkeeper --agent claude-code codex
```

Requirements: Node.js 18+ and `npx`. The agent uses the skill's bundled Node helper scripts during long-goal workflows.

Skill-compatible agents can automatically load installed skills when a request strongly matches their metadata. Goalkeeper is written to match `/goal`, long-running work, compaction, resume, handoff, and continuity-preservation language.

So this can be enough:

> `/goal` Harden this release over a long-running session. Use goalkeeper.

But skill activation is still a routing decision, not a private runtime hook. Goalkeeper cannot force itself onto every goal.

For important long-running work, the safest path is to be explicit when you create the goal, or immediately after creating it:

> Use goalkeeper for this goal.

That is the whole user-facing instruction. After that, you should not have to name the checkpoint, context pack, event log, failed attempts, verification state, or helper scripts yourself. The agent runs Goalkeeper as part of the skill workflow.

## The Problem

If you use an agent for small tasks, compaction is just a detail. The agent can usually recover.

But long goals are different.

Imagine a real session:

1. You ask an agent to fix a payment bug.
2. Early in the work, it discovers `refunds` is legacy code and should not be touched.
3. The quickest patch would edit `refunds`, so you reject that path.
4. The agent tries moving the fix into a webhook handler, but duplicate events break it.
5. It finally proves the safe route: put an idempotency guard in the service layer and cover it with a regression test.
6. The test passes. That route is now the one you want preserved.
7. The context compacts.
8. Later, the agent resumes from a clean summary: "payment bug mostly fixed."
9. It still knows the goal, but may no longer remember that `refunds` was off-limits, that the webhook attempt failed, or that the service-layer test is what made the route safe.

That is where drift starts.

The failure mode is not "the model forgot everything." It is worse: it remembers enough to continue, but not enough to continue in the same direction.

You see it when an agent:

- reopens an approach the user already rejected
- repeats a failed attempt because the failure was summarized away
- treats an unverified assumption as settled fact
- loses the exact next action after a long handoff
- preserves the goal but loses the operating constraints
- gives a polished explanation that no longer matches the workstream

Goalkeeper exists for that gap between "the goal is still known" and "the session still has its bearings."

## What The Agent Does

When the skill is active, the agent maintains a project-local continuity folder:

```text
.goalkeeper/
  active-session
  sessions/
    <goal-session-id>/
      checkpoint.md
      context-pack.md
      events.jsonl
```

Each file has a different job:

- `checkpoint.md` is the short "read this first" recovery state.
- `context-pack.md` preserves the reasoning chain that is too detailed for the checkpoint.
- `events.jsonl` records decisions, failed attempts, command evidence, verification, risks, and handoffs.

The active goal says where the work is going. Goalkeeper preserves why this is still the right route.

## How It Works

Goalkeeper turns long agent work into a simple loop:

```text
Long /goal begins
  -> the agent creates or resumes a Goalkeeper session
  -> important constraints and decisions are recorded
  -> failed attempts are kept so they are not repeated
  -> verification evidence is logged when confidence changes
  -> checkpoint.md is refreshed at meaningful boundaries
  -> context-pack.md keeps the deeper reasoning chain
  -> after resume, handoff, or suspected compaction, the agent reads checkpoint.md first
  -> if the checkpoint is too thin, the agent reads context-pack.md
  -> if exact proof is needed, the agent checks events.jsonl or source files
```

This is not transcript storage. It is working-state preservation.

## Why It Is Small On Purpose

The obvious version of this project is too big:

- a daemon
- a database
- a session rewriter
- a private runtime hook
- a vector memory layer
- a full transcript engine

Goalkeeper intentionally avoids that.

It uses files because files are visible, reviewable, portable, and easy for agents to read after compaction. The point is not to make the agent omniscient. The point is to make the next turn start from the right state.

## What This Is Not

- Not a Codex or Claude Code plugin.
- Not an MCP server.
- Not a database.
- Not a transcript archive.
- Not a private agent runtime hook.
- Not a guarantee of perfect memory.
- Not a way to reduce compaction frequency.

Goalkeeper improves continuity. It does not pretend to eliminate context limits.

## What Gets Better

With Goalkeeper, a resumed session has a better chance to recover:

- the user's non-negotiable constraints
- the current implementation direction
- the reason rejected alternatives stayed rejected
- the tests or commands that changed confidence
- the real next action
- unresolved risks that should not be hand-waved away

That is enough to prevent many of the boring, expensive failures in long agent runs.

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
