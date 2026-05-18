# Goalkeeper Checkpoint

## Active Goal

- Objective: Ship a long-running agent feature without losing direction after repeated compaction.
- Done criteria: The implementation, tests, documentation, and handoff are complete; no known blocker remains untracked.
- Current status: Example state for Goalkeeper.

## Throughline

- Current direction: Preserve the user's intent, constraints, major decisions, verification state, and next action in a short project-local checkpoint.
- Why this direction: The host agent's active goal describes the destination, but repeated compaction can blur the decision chain that explains how to keep moving.

## Constraints

- Non-negotiable: Read this checkpoint before resuming after compaction or handoff.
- Non-negotiable: Append important evidence to `events.jsonl` before updating this checkpoint.
- Forbidden approaches: Treating memory as exact proof when the event log or source files are needed.

## Decisions

- Runtime state lives under `.goalkeeper/sessions/<goal-session-id>/`.
- The checkpoint stays concise and current.
- The event log keeps append-only evidence.

## Attempts And Failures

- Avoid writing full transcripts into the checkpoint; it becomes too long to read routinely.
- Avoid relying only on the active goal; it does not preserve enough decision context.

## Important Files

- `SKILL.md`
- `.goalkeeper/sessions/<goal-session-id>/checkpoint.md`
- `.goalkeeper/sessions/<goal-session-id>/context-pack.md`
- `.goalkeeper/sessions/<goal-session-id>/events.jsonl`

## Context Pack

- `examples/goalkeeper-session/context-pack.md`

## Verification

- Verified: This is a static example, not a live project verification result.
- Not yet verified: Replace this section with real command/test evidence during actual work.

## Open Risks

- Agents may skip reading the checkpoint unless the skill makes the recovery ritual explicit.
- Checkpoints can become stale if not updated at meaningful transitions.

## Next Action

- Read recent events when this checkpoint is insufficient, then continue from the stated next action.

## Last Updated

- 2026-05-17
