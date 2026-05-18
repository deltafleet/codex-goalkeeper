# Workflow

## Start

When a user starts a long-running goal:

1. Confirm the active objective from the user request or host agent goal state.
2. Choose a stable goal session id.
3. Create `.goalkeeper/sessions/<goal-session-id>/checkpoint.md` if missing.
4. Create `.goalkeeper/sessions/<goal-session-id>/context-pack.md` if missing.
5. Create `.goalkeeper/sessions/<goal-session-id>/events.jsonl` if missing.
6. Write `.goalkeeper/active-session` when this is the current Goalkeeper session for the workspace.
7. Append a `goal` event.
8. Record any explicit user constraints as `user_constraint` events.
9. Write the initial checkpoint and seed context pack.

Use the init helper when available:

```bash
node <skill-path>/scripts/goalkeeper-init.mjs --workspace <workspace> --session <goal-session-id> --goal "<active goal>"
```

Pass repeated `--constraint "<text>"` flags for known durable constraints. The helper refuses to overwrite an existing session unless `--force` is explicitly provided.
By default, it updates `.goalkeeper/active-session`; pass `--no-activate` when creating a non-current session.

## Continue

During normal work:

- Append `decision` events for direction-setting choices.
- Append `attempt` events for meaningful implementation or investigation paths.
- Append `failure` events when a path should not be repeated without new evidence.
- Append `command` or `verification` events for commands whose output changes confidence.
- Append `risk` events for unresolved issues.
- Keep `checkpoint.md` aligned with the current state.

Use the append helper for routine event writes:

```bash
node <skill-path>/scripts/goalkeeper-append-event.mjs --workspace <workspace> --session <goal-session-id> --type verification --text "<summary>"
```

If `.goalkeeper/active-session` points to the target session, `--session` may be omitted. The helper reports the appended JSONL line number so later checkpoint evidence can cite the event precisely.

When the event changes the recoverable working state, refresh the checkpoint in the same working segment:

```bash
node <skill-path>/scripts/goalkeeper-update-checkpoint.mjs \
  --workspace <workspace> \
  --session <goal-session-id> \
  --goal "<active goal>" \
  --done "<done criteria>" \
  --status "<current status>" \
  --throughline "<current direction>" \
  --constraint "<durable constraint>" \
  --decision "<current decision>" \
  --verified "<trusted verification>" \
  --risk "<open risk>" \
  --next "<exact next action>"
```

If `.goalkeeper/active-session` points to the target session, `--session` may be omitted. The helper rewrites only `checkpoint.md` and refuses to write over the configured size budget, so long-running sessions do not silently turn the checkpoint into a transcript.

Use `context-pack.md` for medium-density reasoning that should survive compaction but should not be read on every turn. Update it at major design or implementation boundaries:

- decision chain
- rejected alternatives
- open threads
- domain or codebase model
- evidence index

## Start of Each Turn

For an already active Goalkeeper-managed task, begin each new assistant turn with a checkpoint-first recovery read before touching normal project files.

Only apply this rule when `.goalkeeper/active-session` exists or the user explicitly resumes a known Goalkeeper session. If the active pointer is absent and the user asks an unrelated question, do not read closed sessions first.

Recommended sequence:

```bash
pwd
find .goalkeeper/sessions -maxdepth 2 -name checkpoint.md
sed -n '1,220p' .goalkeeper/sessions/<goal-session-id>/checkpoint.md
```

If the turn-start helper is available, use it instead of manually reading the checkpoint:

```bash
node <skill-path>/scripts/goalkeeper-turn-start.mjs --workspace <workspace> --session <goal-session-id>
```

If `.goalkeeper/active-session` points to the correct session id, omit `--session`:

```bash
node <skill-path>/scripts/goalkeeper-turn-start.mjs --workspace <workspace>
```

If checkpoint recovery is too thin, include the context pack:

```bash
node <skill-path>/scripts/goalkeeper-turn-start.mjs --workspace <workspace> --context
```

## Resume After Compaction

When the conversation appears compacted or the agent is resuming after a long gap:

1. Read `checkpoint.md`.
2. Read `context-pack.md` if the checkpoint does not explain why the current direction exists.
3. Read recent `events.jsonl` entries if exact prior evidence is needed.
4. Search `events.jsonl` for a topic if exact prior evidence is needed.
5. Do not proceed from memory alone when the checkpoint says a risk or constraint is open.

### Recovery Guardrail

After resume or suspected compaction, the first project-state action should be reading the active Goalkeeper checkpoint.

Allowed before the checkpoint read:

- determine `pwd`
- list `.goalkeeper/sessions/`
- inspect filenames only when needed to choose the active session id
- run `goalkeeper-turn-start.mjs --session <goal-session-id>` or `goalkeeper-turn-start.mjs --workspace <workspace> --session <goal-session-id>`

Not allowed before the checkpoint read:

- sending a user-visible progress, status, or direction message based on memory
- reading `README.md`, `docs/`, `src/`, examples, tests, or other project files
- editing files
- running verification commands that depend on recovered state
- relying on the compacted summary as the source of current direction

If an agent violates this order, append a `recovery_violation` event, read the checkpoint immediately, and continue only after reconciling the current action with the checkpoint.

Before relying on a workspace for a long run, run the read-only doctor:

```bash
node <skill-path>/scripts/goalkeeper-doctor.mjs --workspace <workspace> --session <goal-session-id> --strict
```

## Goal Session Directory

The goal session directory is project-local, not global:

```text
<workspace>/.goalkeeper/sessions/<goal-session-id>/
```

Use one directory per long-running agent goal session. A compacted conversation, resumed thread, or handoff should keep using the same directory when the underlying goal is the same.

Suggested id format:

```text
YYYY-MM-DD-short-goal-slug
```

Example:

```text
.goalkeeper/sessions/2026-05-17-goalkeeper-roadmap/
```

## Handoff

Before ending a long working segment:

1. Append a `handoff` event.
2. Update `checkpoint.md` with the current state and exact next action.
3. Include unresolved risks and verification gaps.

## Shutdown

Before sending the final completion response for a Goalkeeper-managed goal:

1. Confirm the done criteria are satisfied, or that the goal was explicitly abandoned or superseded.
2. Run the close helper:

   ```bash
   node <skill-path>/scripts/goalkeeper-close.mjs --workspace <workspace> --outcome "<final outcome>"
   ```

3. Include repeated `--risk "<text>"` and `--evidence "<text>"` fields when residual risks or final proof should remain recoverable.
4. Verify `.goalkeeper/active-session` was removed when it pointed to the closed session.
5. Send the final completion response.

After shutdown, do not apply checkpoint-first recovery to unrelated user questions. Read the closed session only if the user explicitly resumes that goal or asks about its history.

## Checkpoint Update Guidance

Update the checkpoint after a meaningful state transition, not after every minor tool call.

Good checkpoint updates:

- A user changes scope.
- A design route is chosen.
- A blocker is discovered.
- A test result proves or disproves the current direction.
- Implementation reaches a stable boundary.
- The next action changes.

Bad checkpoint updates:

- Repeating the same status after every file read.
- Copying long command output into the checkpoint.
- Adding uncertain claims without evidence.
- Refreshing the checkpoint without first appending the event that explains why the state changed.
