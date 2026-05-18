# Goalkeeper Context Pack

## Purpose

This example context pack keeps reasoning that is too detailed for the checkpoint but useful after compaction.

## Active Goal

Ship a long-running Codex feature without losing direction after repeated compaction.

## Durable Constraints

- Read the checkpoint before resuming after compaction or handoff.
- Append important evidence to `events.jsonl` before updating the checkpoint.

## Working Model

- `checkpoint.md` is the small turn-start recovery note.
- `context-pack.md` carries the larger reasoning chain.
- `events.jsonl` is the append-only evidence trail.

## Decision Chain

- Keep state project-local so it travels with the workspace.
- Keep checkpoint short so agents actually read it.
- Use the context pack only when the checkpoint is too thin.

## Rejected Alternatives

- Full transcript storage in the checkpoint.
- Treating Codex goal metadata as enough for long-running work.

## Open Threads

- In a real project, replace this example with the actual codebase model and unresolved questions.

## Evidence Index

- `examples/goalkeeper-session/events.jsonl`
