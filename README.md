# Codex Goalkeeper

Long Codex runs do not usually fail all at once.

They drift.

The agent still sounds confident. The tests still run. The plan still looks plausible. But after enough compaction, handoffs, and resumed turns, the session can quietly forget the thing that mattered most:

> Why were we doing it this way?

Codex Goalkeeper is a small skill that helps Codex keep long-running `/goal` work oriented across compaction, resumes, and handoffs.

It does not add a hidden memory engine. It gives the agent a durable working ritual:

- keep a short checkpoint
- keep a richer context pack
- append decisions and verification to an event log
- read the checkpoint before continuing after drift-prone boundaries

Boring files. Better continuity.

[한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh-CN.md)

## Install

```bash
npx skills add deltafleet/codex-goalkeeper
```

Requirements: Node.js 18+ and `npx`. Codex uses the skill's bundled Node helper scripts during long-goal workflows.

Codex can automatically load installed skills when a request strongly matches their metadata. Goalkeeper is written to match `/goal`, long-running work, compaction, resume, handoff, and continuity-preservation language.

So this can be enough:

> `/goal` Harden this release over a long-running session. Keep the goal, constraints, rejected paths, failed attempts, verification state, and next action recoverable after compact/resume.

But skill activation is still a routing decision, not a private Codex runtime hook. Goalkeeper cannot force itself onto every goal.

For important long-running work, the safest path is to be explicit when you create the goal, or immediately after creating it:

> Use codex-goalkeeper for this `/goal`. Keep the goal, constraints, decisions, verification state, failed attempts, and next action recoverable across compaction.

After that, you should not have to run Goalkeeper's helper scripts yourself. Codex runs them as part of the skill workflow.

## The Problem

If you use Codex for small tasks, compaction is just a detail. The agent can usually recover.

But long goals are different.

Imagine a real session:

1. You ask Codex to harden a release.
2. The obvious patch fixes the visible bug, but would break rollback compatibility.
3. You set a hard constraint: no database schema change, keep backward compatibility.
4. A second attempt passes unit tests, but fails an integration edge case.
5. Codex settles on a compatibility shim plus a targeted regression test.
6. The regression test passes. That path is now the safe one.
7. The context compacts.
8. Later, the agent resumes from a clean summary: "release hardening mostly done."
9. It still knows the goal, but may no longer feel why the schema shortcut stayed forbidden, why the first patches failed, or why that regression test mattered.

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

## What Codex Does

When the skill is active, Codex maintains a project-local continuity folder:

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

The active Codex goal says where the work is going. Goalkeeper preserves why this is still the right route.

## How It Works

Goalkeeper turns long agent work into a simple loop:

```text
Long /goal begins
  -> Codex creates or resumes a Goalkeeper session
  -> important constraints and decisions are recorded
  -> failed attempts are kept so they are not repeated
  -> verification evidence is logged when confidence changes
  -> checkpoint.md is refreshed at meaningful boundaries
  -> context-pack.md keeps the deeper reasoning chain
  -> after resume, handoff, or suspected compaction, Codex reads checkpoint.md first
  -> if the checkpoint is too thin, Codex reads context-pack.md
  -> if exact proof is needed, Codex checks events.jsonl or source files
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

It uses files because files are visible, reviewable, portable, and easy for agents to read after compaction. The point is not to make Codex omniscient. The point is to make the next turn start from the right state.

## What This Is Not

- Not a Codex plugin.
- Not an MCP server.
- Not a database.
- Not a transcript archive.
- Not a private Codex runtime hook.
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
src/codex-goalkeeper/       # installable skill payload
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
find src/codex-goalkeeper/scripts tests -name '*.mjs' -print0 | xargs -0 -n1 node --check
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
