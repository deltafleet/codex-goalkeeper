# Changelog

All notable changes to Goalkeeper are documented here.

This project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-05-18

- Renamed the public project to `goalkeeper`.
- Renamed the npm package to `@deltafleet/goalkeeper`.
- Generalized the skill for Claude Code, Codex, and other skill-compatible coding agents.
- Added a Claude Code guardrail template and doctor support for `CLAUDE.md`.
- Kept backward-compatible `codex-goalkeeper-*` CLI aliases for existing users.

## [0.1.1] - 2026-05-18

- Moved the installable skill payload into `src/goalkeeper/` so Skills CLI installs only skill files.
- Kept repository docs, tests, examples, and GitHub metadata outside the installable skill directory.
- Added Node.js 18+ requirement notes to the README files.

## [0.1.0] - 2026-05-18

Initial public release.

- Added the `goalkeeper` skill.
- Added project-local `.goalkeeper/` session layout.
- Added checkpoint, context pack, and JSONL event workflow.
- Added helper scripts for init, turn start, event append, checkpoint update, and doctor checks.
- Added examples, templates, multilingual READMEs, and open-source operating docs.
