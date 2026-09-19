# Contributing

Thank you for helping WolfMarkDown handle real Markdown failures while keeping the implementation small and auditable.

## Local setup

Requires Node.js 20 or newer. From the repository root:

```bash
npm ci --prefix wolfmarkdown
```

## Checks

Run the full Node test suite:

```bash
npm test
```

Validate the public Agent Skill package:

```bash
npx --yes skills-ref validate ./wolfmarkdown
```

Verify the public example with integrity comparison:

```bash
node wolfmarkdown/scripts/verify-markdown.mjs \
  examples/mobile-app-migration/output.md \
  --integrity-from examples/mobile-app-migration/input.md
```

Useful local diagnostics include:

```bash
node wolfmarkdown/scripts/doctor.mjs
node wolfmarkdown/scripts/scaffold-markdown.mjs path/to/file.md --json
node wolfmarkdown/scripts/evaluate-semantic.mjs --help
```

## Project boundaries

- Keep semantic judgement with the agent; deterministic scripts prove artifact properties.
- Keep Prettier as the sole final Markdown printer.
- Do not add deterministic table or heading reconstruction heuristics.
- Add both a positive conservative case and a negative adversarial case for semantic-behaviour changes.
- Prefer structural assertions and synthetic or redacted fixtures over brittle full-document snapshots.
- Never commit private research, secrets, live operational identifiers, or failed user output.

For product behaviour and architecture, see [Architecture and semantic repair](./docs/architecture.md) and [Verification, integrity, and PASS](./docs/verification.md).

## Issues and pull requests

Open an issue with a small, reproducible Markdown example and the expected structural outcome. Pull requests are most useful when they include focused tests, preserve the single canonical skill, and explain any compatibility or evidence boundary.
