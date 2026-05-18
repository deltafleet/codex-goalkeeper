# Event Schema

Events are newline-delimited JSON records in the current goal session's `events.jsonl`.

Default path:

```text
<workspace>/.goalkeeper/sessions/<goal-session-id>/events.jsonl
```

Prefer the append helper when available:

```bash
node <skill-path>/scripts/goalkeeper-append-event.mjs --workspace <workspace> --session <goal-session-id> --type decision --text "<summary>"
```

When `<workspace>/.goalkeeper/active-session` points to the current session, `--session` may be omitted. The helper validates existing JSONL schema before writing and reports the appended line number.

## Required Fields

```json
{"ts":"2026-05-17T00:00:00Z","type":"decision","text":"Use skill-only continuity files before adding optional MCP automation."}
```

- `ts`: ISO timestamp.
- `type`: event type.
- `text`: concise event summary.

## Optional Fields

- `goal`: active goal identifier or short title.
- `reason`: why the event matters.
- `evidence`: short supporting detail.
- `files`: array of file paths.
- `commands`: array of commands.
- `status`: `open`, `done`, `failed`, `blocked`, `superseded`, or `closed`.
- `supersedes`: event id or short reference.

## Initial Types

- `goal`: objective or done criteria changed.
- `user_constraint`: user gave a durable constraint or forbidden path.
- `decision`: direction-setting choice.
- `attempt`: meaningful path tried.
- `failure`: path failed or should not be repeated.
- `edit`: important file or artifact changed.
- `command`: command result worth preserving.
- `verification`: verification evidence.
- `risk`: unresolved risk or blocker.
- `handoff`: current state prepared for resume.
- `next_action`: explicit next step.
- `compact_observed`: a real agent compaction boundary was observed.
- `recovery_violation`: the agent continued after compaction or resume before reading the Goalkeeper checkpoint.
- `close`: the managed goal was completed, abandoned, or superseded and the active session should stop applying to unrelated questions.

## Writing Rules

- Keep records one line each.
- Prefer `goalkeeper-append-event.mjs` over manual edits for routine event writes.
- Expect `goalkeeper-doctor.mjs` to fail if event type, timestamp, text, status, files, or commands violate this schema.
- Prefer exact paths and commands when they matter.
- Do not paste large output. Summarize and link to artifact paths.
- Use `failure` only when the result should influence future behavior.
- Use `verification` only when the result changes confidence.
