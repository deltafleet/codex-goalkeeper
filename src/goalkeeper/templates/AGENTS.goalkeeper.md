# Goalkeeper Guardrail

When this repository has an active `.goalkeeper/active-session` pointer, treat the referenced `.goalkeeper/sessions/<goal-session-id>/` directory as the continuity source for long-running agent work.

If `.goalkeeper/active-session` is absent and the user asks an unrelated question, do not read closed Goalkeeper sessions first.

At the start of each new assistant turn, before reading normal project files or making edits:

1. Run `pwd` if the workspace is unclear.
2. Locate the active checkpoint under `.goalkeeper/sessions/`.
3. Read `.goalkeeper/sessions/<goal-session-id>/checkpoint.md`.
4. If the checkpoint is unclear or too thin, read `.goalkeeper/sessions/<goal-session-id>/context-pack.md`.
5. If exact evidence is needed, inspect recent `.goalkeeper/sessions/<goal-session-id>/events.jsonl` entries.

If this repository includes `scripts/goalkeeper-turn-start.mjs`, you may use:

```bash
node scripts/goalkeeper-turn-start.mjs --session <goal-session-id>
```

If `.goalkeeper/active-session` contains the current session id, this shorter form is also valid:

```bash
node scripts/goalkeeper-turn-start.mjs
```

If the helper comes from an installed skill path instead of this repository, pass the target workspace:

```bash
node <skill-path>/scripts/goalkeeper-turn-start.mjs --workspace <workspace> --session <goal-session-id>
```

If checkpoint recovery needs the larger context pack too, add `--context`.

Allowed before reading the checkpoint:

- `pwd`
- listing `.goalkeeper/sessions/`
- reading `.goalkeeper/active-session`
- minimal filename inspection needed to choose the active session
- running `node scripts/goalkeeper-turn-start.mjs --session <goal-session-id>`
- running `node scripts/goalkeeper-turn-start.mjs`
- running `node <skill-path>/scripts/goalkeeper-turn-start.mjs --workspace <workspace> --session <goal-session-id>`
- adding `--context` to the turn-start command when the checkpoint is too thin

Do not read project docs, source files, examples, tests, or make edits before the checkpoint read.

If you notice that you continued after compaction or resume without reading the checkpoint, stop, read it immediately, append a `recovery_violation` event, then continue from the recovered state.

When the managed goal is complete, run `goalkeeper-close.mjs` before sending the final completion response. This records the final outcome and removes `.goalkeeper/active-session` so later unrelated questions are not treated as goal recovery.

Do not claim Goalkeeper reduces compaction frequency. Its purpose is direction recovery after compaction, resume, or handoff.
