# WolfMarkDown

WolfMarkDown is a cross-agent Markdown repair skill for creating, cleaning, sanitising, formatting, and verifying standalone Markdown. It aims for production-ready output when the agent's semantic review and the deterministic checks both pass; the scripts do not certify arbitrary prose structure.

It is the trusted Markdown output layer for an agent: when you explicitly want a `.md` file created, exported, saved, cleaned, or validated, WolfMarkDown takes responsibility for a standalone, verified result.

## Capabilities

- Clean existing Markdown
- Compose or export a new Markdown file
- Remove copied-agent conversation scaffolding
- Repair headings, lists, fences, and comparison tables when source intent is clear
- Map latent source structure before editing, then reconcile every clear signal before deterministic verification
- Preserve technical identifiers, URLs, and meaningful citations
- Format deterministically with Prettier as the sole final printer
- Validate with markdownlint and GFM checks before publishing
- Restore the original file if a Clean cannot be verified
- Avoid publishing failed Compose output

WolfMarkDown does not rewrite already-good prose for style, and it does not take over ordinary summaries or notes just because they could be written as Markdown.

## Requirements

Node.js 20 or newer is supported, including Node.js 22 and Node.js 24. Both the repository package and the WolfMarkDown runtime package declare `engines.node` as `>=20`.

## Supported agents

One implementation. Agent-specific paths are discovery links only.

| Agent | Support | Discovery | Evidence |
| --- | --- | --- | --- |
| Codex | Tier 1 | Shared Agent Skills | Standard-compatible |
| Cursor | Tier 1 | Shared Agent Skills | Standard-compatible |
| Grok Build | Tier 1 | Shared Agent Skills | Tested in this repository |
| Claude Code | Tier 1 | Claude compatibility link | Standard-compatible |
| OpenCode | Tier 1 | Shared Agent Skills | Standard-compatible; acceptance pending |
| Gemini CLI | Tier 1 | Shared Agent Skills | Standard-compatible; acceptance pending |
| Antigravity | Tier 1 | Project/shared Agent Skills | Standard-compatible; acceptance pending |
| GitHub Copilot | Tier 2 | Shared Agent Skills | Standard-compatible; not acceptance-tested |

Slash-style `/wolfmarkdown` is harness-specific (Grok, sometimes Claude). Other agents should be invoked in natural language.

## Installation

The Agent Skills directory name must match `wolfmarkdown`, so the implementation lives in `wolfmarkdown/` rather than the repository root. `skills-ref validate` rejects a root-level `SKILL.md` because this repository is named `WolfMarkDown`.

For repository development or a fresh checkout:

```bash
npm ci --prefix wolfmarkdown
node wolfmarkdown/scripts/install.mjs
```

Normal `/wolfmarkdown setup` uses the same installer after its health check and does not reinstall dependencies that are already healthy.

From the repository root, `npm test` delegates to that directory.

The installer command:

- installs runtime dependencies if needed
- links `~/.agents/skills/wolfmarkdown` for shared Agent Skills discovery
- links `~/.claude/skills/wolfmarkdown` for Claude Code

On Windows it uses a directory junction when a symlink cannot be created. It does not copy the skill tree.

Inside this checkout, `.agents/skills/wolfmarkdown` points at `wolfmarkdown/` so the skill is discoverable before a global install.

A harness may need a reload after setup.

## Usage

Portable:

```text
Use WolfMarkDown on docs/architecture.md.
Export this research as Markdown using WolfMarkDown.
Save this as docs/research/wallet-analysis.md.
Verify docs/architecture.md with WolfMarkDown.
Set up WolfMarkDown.
```

Where slash commands exist:

```text
/wolfmarkdown setup
/wolfmarkdown doctor
/wolfmarkdown docs/architecture.md
/wolfmarkdown verify docs/architecture.md
```

Developer commands from this repository:

```bash
node wolfmarkdown/scripts/doctor.mjs
node wolfmarkdown/scripts/format-markdown.mjs path/to/file.md
node wolfmarkdown/scripts/verify-markdown.mjs path/to/file.md
node wolfmarkdown/scripts/verify-markdown.mjs path/to/file.md --json
```

## Architecture

The agent owns judgement: intent, conversation sanitisation, decorative versus substantive emoji, structure, and composition. Clean and Compose use a two-pass workflow: map source boundaries, tables, labelled groups, sequences, paragraphs, and protected regions; then reconcile the candidate against that map. A deterministic pass does not make flattened or semantically poor prose production-ready.

Scripts own deterministic proof: GFM parse, Prettier, markdownlint, fence balance, frontmatter, protected-token integrity, idempotence, install, and doctor.

Prettier is the only final printer.

## Development

```bash
npm ci --prefix wolfmarkdown
npm test
npx --yes skills-ref validate ./wolfmarkdown
```

For installation through the published Agent Skills CLI, use:

```bash
npx skills add WolfMarkTools/WolfMarkDown --skill wolfmarkdown
```

Semantic cases live in `wolfmarkdown/tests/evals/`. Cross-agent acceptance inputs live in `wolfmarkdown/tests/acceptance/`.

## Limitations

- `/wolfmarkdown setup` only works after the skill is already discoverable.
- `--mode` is not supported.
- Vendor-specific skill copies are not created.
- Windows still needs permission to create a junction or symlink.
- Semantic sanitisation remains agent-judged.
- The verifier proves Markdown and content-integrity properties; it does not understand arbitrary prose or certify recovered semantic structure.

## Licence

[MIT](./LICENSE)
