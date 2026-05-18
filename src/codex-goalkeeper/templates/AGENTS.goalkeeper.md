# Goalkeeper Guardrail

When this repository has an active `.goalkeeper/sessions/<goal-session-id>/` directory, treat it as the continuity source for long-running Codex work.

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

Do not claim Goalkeeper reduces compaction frequency. Its purpose is direction recovery after compaction, resume, or handoff.
