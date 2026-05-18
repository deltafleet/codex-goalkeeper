# Roadmap

## Product Thesis

Long-running agent goals need a small continuity layer outside the model context.

Goalkeeper should stay boring: a short checkpoint, a medium-density context pack, an append-only event log, a turn-start helper, a close helper, and a doctor check. It should not become a substitute context engine or a promise of perfect post-compact recovery.

## MVP

Ship an agent skill under `src/goalkeeper/` that manages project-local state:

```text
.goalkeeper/
  active-session
  sessions/
    <goal-session-id>/
      checkpoint.md
      context-pack.md
      events.jsonl
```

Core behavior:

- initialize a Goalkeeper session for a long-running goal
- read the active checkpoint first after resume or suspected compaction
- read the context pack when the checkpoint is too thin to recover pre-compaction reasoning
- append meaningful decisions, failures, verification, and handoff events
- refresh the checkpoint when recoverable working state changes
- close the active session when the managed goal completes so unrelated questions do not trigger recovery
- run a read-only doctor before trusting a workspace for long work

## User-Facing Scope

Keep these scripts central:

- `goalkeeper-init.mjs`
- `goalkeeper-turn-start.mjs`
- `goalkeeper-append-event.mjs`
- `goalkeeper-update-checkpoint.mjs`
- `goalkeeper-close.mjs`
- `goalkeeper-doctor.mjs`

Keep this optional and maintainer-oriented:

- `tests/test-goalkeeper-update-checkpoint.mjs`

## Non-Goals

- no MCP server in the MVP
- no host-agent plugin packaging in the MVP
- no SQLite or global database
- no background daemon
- no prompt-assembly hook
- no host-agent session rewriting
- no claim of 100 percent compact recovery

## Good Enough Release Bar

- `npx skills add . --list` discovers exactly one skill named `goalkeeper`
- the skill body is concise enough to load routinely
- README explains the simple workflow clearly
- multilingual READMEs keep the same public workflow in Korean, Japanese, and Chinese
- examples parse as valid JSONL
- script syntax checks pass
- checkpoint update helper test passes
- doctor passes against this repo's live Goalkeeper state

## Later, Only If Needed

Possible future additions should be justified by real usage:

- a tiny CLI wrapper around the existing scripts
- event search helper
- checkpoint compaction helper
- optional MCP ergonomics
- cross-workspace indexing

These should not change the source of truth: project-local `.goalkeeper/` files.
