# Contributing

Thanks for considering a contribution to Codex Goalkeeper.

The project has one strong bias: keep the core small enough that agents will actually use it during long work.

## Good Contributions

- Make checkpoint-first recovery easier to follow.
- Improve script reliability without adding hidden services.
- Improve documentation, examples, or translations.
- Add tests around existing helper behavior.
- Tighten validation or error messages.

## Contributions That Need Extra Justification

- New persistent state beyond `.goalkeeper/`.
- Background processes.
- Runtime hooks into private Codex internals.
- Global databases or cross-project indexing.
- Large abstractions around the five core helper scripts.

These may be useful later, but they should not enter the project without a clear real-world failure case.

## Local Validation

Run:

```bash
npm run validate
```

Manual equivalent:

```bash
find src/scripts -name '*.mjs' -print0 | xargs -0 -n1 node --check
node src/scripts/test-goalkeeper-update-checkpoint.mjs
find examples -name '*.jsonl' -print0 | xargs -0 -n1 jq -c . >/dev/null
npx skills add . --list
```

## Pull Request Checklist

- Keep `SKILL.md` concise.
- Keep `README.md` useful for first-time readers.
- Update translated READMEs when changing the public workflow.
- Update `CHANGELOG.md` for user-visible changes.
- Update `docs/RELEASE.md` if the release process changes.
- Do not add secrets, local `.goalkeeper/` state, or generated scratch output.

## Versioning

Use SemVer:

- Patch for docs, examples, tests, and compatible bug fixes.
- Minor for new compatible helpers or workflow fields.
- Major for breaking checkpoint, event, or script contracts.
