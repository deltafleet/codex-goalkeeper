# Goalkeeper Guardrail

The skill body is not enough to guarantee checkpoint-first behavior after compaction. Codex may resume from a compacted summary without the model noticing the exact session-log marker.

For high-stakes long-running work, add the AGENTS guardrail template to the target workspace:

```text
templates/AGENTS.goalkeeper.md
```

Use it in one of these ways:

- Copy the whole template into the target repository's `AGENTS.md`.
- Merge the checkpoint-first section into an existing `AGENTS.md`.
- Keep the template as project documentation and explicitly ask Codex to follow it before starting a long goal.

The guardrail is still skill-first. It does not require a plugin, MCP server, database, or private Codex runtime hook. It uses a surface Codex already honors: repository instructions.

## Why This Matters

Compacted or resumed sessions can restart from a thin summary. The practical fix is to move the checkpoint-first rule into an always-on project instruction for workspaces that opt in.

## Minimum Rule

For an active Goalkeeper-managed goal:

1. Read `.goalkeeper/sessions/<goal-session-id>/checkpoint.md` before normal project files.
2. Use `context-pack.md` when the checkpoint is too thin to recover the reasoning chain.
3. Use `events.jsonl` only when exact evidence is needed.
4. Append `recovery_violation` if the agent continued after compaction or resume before reading the checkpoint.

If `scripts/goalkeeper-turn-start.mjs` is present, it can be used as the first recovery action:

```bash
node scripts/goalkeeper-turn-start.mjs --session <goal-session-id>
```

If `.goalkeeper/active-session` contains the current session id, this shorter form is valid:

```bash
node scripts/goalkeeper-turn-start.mjs
```

If the helper is being run from an installed skill package rather than from the target repository, pass the target workspace explicitly:

```bash
node <skill-path>/scripts/goalkeeper-turn-start.mjs --workspace <workspace> --session <goal-session-id>
```

Add `--context` when the medium-density context pack is needed:

```bash
node <skill-path>/scripts/goalkeeper-turn-start.mjs --workspace <workspace> --session <goal-session-id> --context
```

Before starting a high-stakes long run, use the read-only doctor to verify the target workspace has the required state and guardrail:

```bash
node <skill-path>/scripts/goalkeeper-doctor.mjs --workspace <workspace> --session <goal-session-id> --strict
```

Parallel calls are still subject to checkpoint-first ordering. It is acceptable to batch `pwd`, `.goalkeeper/sessions` discovery, and `goalkeeper-turn-start.mjs`; it is not acceptable to include normal project files or verification in that same first post-compact parallel call.
