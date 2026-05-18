# Release Policy

Goalkeeper is released as a GitHub repository and optional npm package.

The installable skill source of truth is:

- `src/goalkeeper/SKILL.md`
- `src/goalkeeper/agents/openai.yaml`
- `src/goalkeeper/scripts/`
- `src/goalkeeper/references/`
- `src/goalkeeper/templates/`
- `examples/`
- `docs/`

## Versioning

Use SemVer.

- `PATCH`: documentation, examples, tests, and compatible bug fixes
- `MINOR`: compatible helper scripts, metadata, templates, or workflow fields
- `MAJOR`: breaking changes to checkpoint, context-pack, event, or script contracts

During `0.x`, minor releases may still adjust public contracts. Document those changes clearly in `CHANGELOG.md`.

## Release Checklist

1. Update `package.json` version.
2. Update `CHANGELOG.md`.
3. Run validation:

   ```bash
   npm run validate
   ```

4. Confirm the public package does not include local Goalkeeper state:

   ```bash
   git status --short --ignored
   npm pack --dry-run
   ```

5. Commit:

   ```bash
   git commit -m "Release vX.Y.Z"
   ```

6. Tag:

   ```bash
   git tag vX.Y.Z
   ```

7. Push:

   ```bash
   git push origin main --tags
   ```

8. Create a GitHub release:

   ```bash
   GH_CONFIG_DIR=$HOME/.config/gh-deltafleet gh release create vX.Y.Z --generate-notes
   ```

9. Optional npm publish:

   ```bash
   npm --userconfig ~/.config/npm-deltafleet/npmrc publish --access public
   ```

## Deltafleet Credentials

This repository can be published with the local deltafleet profiles:

- GitHub CLI: `GH_CONFIG_DIR=$HOME/.config/gh-deltafleet`
- npm: `npm --userconfig ~/.config/npm-deltafleet/npmrc`

Never commit these config files or token values.
