# Goalkeeper Repository Instructions

Keep this repository lean. The public release should stay focused on the core skill workflow:

- project-local `.goalkeeper/` state
- `checkpoint.md`
- `context-pack.md`
- `events.jsonl`
- small helper scripts

Do not add plugin packaging, MCP servers, global databases, background daemons, or private host-agent runtime hooks unless a future release explicitly changes scope.

When working in a Goalkeeper-managed workspace, read the active checkpoint before normal project work after resume, handoff, or suspected compaction.
The active checkpoint lives under `.goalkeeper/sessions/<goal-session-id>/checkpoint.md`; treat that checkpoint-first read as the first project-state action for resumed long-running work.
