# Security Policy

## Supported Versions

The latest minor release receives security fixes.

During the `0.x` series, APIs may still evolve, but security fixes will be released as patch versions whenever possible.

## Reporting A Vulnerability

Do not open a public issue for a vulnerability.

Report security concerns through GitHub private vulnerability reporting when available, or contact the maintainers through the repository owner profile.

Include:

- affected version or commit
- reproduction steps
- expected impact
- whether the issue exposes local files, credentials, or private project state

## Project Boundaries

Goalkeeper stores state in project-local `.goalkeeper/` directories. It should not require:

- secret tokens
- background daemons
- network access for normal helper scripts
- private host-agent runtime hooks
- global databases

If a change introduces any of those, treat it as security-sensitive and document the reason clearly.
