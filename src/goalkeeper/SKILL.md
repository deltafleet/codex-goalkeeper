---
name: goalkeeper
description: Use automatically for Claude Code /goal, Codex /goal, long-running agent goals, multi-turn implementations, session resumes, handoffs, compacted conversations, or any task where an AI coding agent must preserve constraints, decisions, verification state, failed attempts, pre-compaction reasoning, and next actions. Maintains a project-local checkpoint, context pack, and append-only event log.
---

# Goalkeeper

Use this skill when an AI coding agent task is expected to run long enough that compaction, handoff, or drift could cause the agent to lose direction.

Goalkeeper does not replace the host agent's goal system. It records the working continuity around the goal.

Goalkeeper is a best-effort continuity habit, not a guarantee that every compacted turn will recover perfectly.

When a user starts or continues a `/goal` in Claude Code, Codex, or another skill-compatible agent, strongly prefer initializing or resuming Goalkeeper unless the task is clearly short-lived.

## First Action Rule

When a Goalkeeper-managed goal is already active, the first project-state action in a new assistant turn should be reading the active checkpoint, unless you have already read it in the same turn.

Only treat Goalkeeper as active when `<workspace>/.goalkeeper/active-session` points to a live session or the user explicitly asks to resume a specific Goalkeeper session. If no active session pointer exists and the user asks an unrelated question, do not apply checkpoint-first recovery.

This is stricter than waiting until you notice compaction. A compacted turn may not reliably expose the compaction marker to the model, so checkpoint-first is the practical recovery rule for long-running goals.

Allowed before the checkpoint read:

- `pwd`
- listing `.goalkeeper/sessions/`
- minimal filename inspection to choose the active Goalkeeper session id

Do not send a user-visible progress or direction message before the checkpoint read.
Do not read project docs, source files, examples, tests, or make edits before the checkpoint read.
Do not combine the checkpoint read with other post-recovery work in the same shell command or parallel tool batch.

## Required Files

Use a project-local `.goalkeeper/` directory. Each long-running goal session gets its own subdirectory:

```text
.goalkeeper/
  active-session  # optional: current goal session id
  sessions/
    <goal-session-id>/
      checkpoint.md
      context-pack.md
      events.jsonl
```

Use a stable, readable `<goal-session-id>` such as `2026-05-17-goalkeeper-roadmap` or `ads-ops-release-hardening`.

If any core file is missing during long goal work, create it from the templates in `templates/`.
Use `.goalkeeper/active-session` when a workspace has one active Goalkeeper session and the agent should not have to reconstruct the session id after compaction.

The directory is created inside the active project workspace, not in a global agent directory. Example:

```text
/path/to/project/.goalkeeper/sessions/2026-05-17-release-hardening/checkpoint.md
```

Bundled scripts live in the skill package. When the script is not located inside the target workspace, pass the target workspace explicitly.

In Claude Code, `${CLAUDE_SKILL_DIR}` can resolve the installed skill directory. In other agents, use the concrete installed skill path:

```bash
node <skill-path>/scripts/goalkeeper-turn-start.mjs --workspace <workspace> --session <goal-session-id>
```

If `<workspace>/.goalkeeper/active-session` points to the session id, `--session` may be omitted:

```bash
node <skill-path>/scripts/goalkeeper-turn-start.mjs --workspace <workspace>
```

To create a new session deterministically, run:

```bash
node <skill-path>/scripts/goalkeeper-init.mjs --workspace <workspace> --session <goal-session-id> --goal "<active goal>"
```

## Recovery Rule

Before continuing after a resume, suspected compaction, long interruption, or handoff:

1. Resolve the current goal session directory under `.goalkeeper/sessions/`.
2. Read its `checkpoint.md`.
3. If the checkpoint is stale, too thin, or missing the reasoning chain, read `context-pack.md`.
4. If exact evidence is needed, inspect recent entries in `events.jsonl`.
5. Restate the active direction internally before taking action.
6. Continue only when the next action matches the recovered goal, constraints, and open risks.

After compaction, do not rely on the compacted conversation summary alone. Read the Goalkeeper checkpoint before continuing.

## Recovery Guardrail

After a visible compact boundary, the first project-state action must be a Goalkeeper recovery read:

```text
<workspace>/.goalkeeper/sessions/<goal-session-id>/checkpoint.md
```

If you notice that you already continued without the checkpoint, stop, read the checkpoint, append a `recovery_violation` event, then continue from the recovered state.

## Update Rule

Update Goalkeeper state when any of these change:

- active goal or done criteria
- user constraints or forbidden approaches
- major design decision
- failed attempt that should not be repeated
- important file or artifact path
- command result or verification status
- open risk, blocker, or next action
- handoff boundary

Append the event first, then update the session's `checkpoint.md` when the event changes the current working state.
Use `scripts/goalkeeper-update-checkpoint.mjs` when you want a bounded canonical checkpoint instead of manual Markdown edits.

## Shutdown Rule

When a Goalkeeper-managed goal is complete, shut down the active Goalkeeper session before sending the final completion response.

Do this when:

- the done criteria are satisfied
- the user explicitly ends the goal
- the work is abandoned, superseded, or intentionally paused without needing checkpoint-first recovery on unrelated questions

Shutdown steps:

1. Append a final `close` event.
2. Mark `checkpoint.md` as closed with the final outcome and residual risks.
3. Remove `.goalkeeper/active-session` when it points to the closed session.
4. Do not apply checkpoint-first recovery to later unrelated user questions.

Use the close helper:

```bash
node <skill-path>/scripts/goalkeeper-close.mjs --workspace <workspace> --outcome "<final outcome>"
```

After shutdown, read the closed session again only if the user explicitly resumes that goal or asks about its history.

## Keep It Short

The checkpoint is a recovery artifact, not a transcript.

Keep it under about 8 KB when possible. If it grows beyond 16 KB, compact stale details into `events.jsonl` evidence references before relying on it for routine recovery.

Prefer:

- exact goal
- current throughline
- non-negotiable constraints
- decisions that explain direction
- verified facts
- open risks
- next action

Avoid:

- narrative summaries of every turn
- long command output
- speculative history
- stale alternatives that no longer matter

## Context Pack

Use `context-pack.md` for medium-density pre-compaction context that is too detailed for the checkpoint:

- decision chain and reasoning
- rejected alternatives
- open threads
- domain model or implementation model
- evidence index for where exact facts live

Read it when checkpoint recovery is not enough. Keep raw transcripts and long command output out of it.

## Reference Map

- Read `references/workflow.md` for lifecycle rules and examples.
- Read `references/event-schema.md` before adding or validating event records.
- Read `references/guardrail.md` when you need stronger always-on behavior in a target repository.
- Run `scripts/goalkeeper-init.mjs` when a long-running goal needs a new `.goalkeeper/sessions/<goal-session-id>/` directory.
- Run `scripts/goalkeeper-turn-start.mjs --context` when checkpoint recovery needs the larger context pack too.
- Run `scripts/goalkeeper-append-event.mjs` instead of hand-writing JSONL when recording decisions, verification, failures, risks, or handoffs; it can use `.goalkeeper/active-session` when `--session` is omitted.
- Run `scripts/goalkeeper-update-checkpoint.mjs` after appending a meaningful event when checkpoint state should be refreshed in a short canonical shape.
- Run `scripts/goalkeeper-close.mjs` before the final completion response when the managed goal is done, abandoned, or superseded.
- Run `scripts/goalkeeper-doctor.mjs` after creating or changing Goalkeeper state to verify the target workspace is ready.

## Safety Boundary

- Do not depend on private Codex, Claude Code, or other host-agent runtime internals.
- Do not claim this reduces compaction frequency.
- Do not treat the checkpoint as proof when exact evidence is needed; inspect `events.jsonl` or source files.
