# WolfMarkDown

WolfMarkDown turns messy Markdown and pasted source material into standalone Markdown people can read, review, and commit. It gives an agent a disciplined repair workflow for structure, safety, and proof instead of treating formatting as a final cosmetic pass.

Use it when a report, research dump, meeting note, agent response, or comparison matrix needs to become a dependable `.md` file. WolfMarkDown aims for structurally production-ready Markdown when the agent's semantic review and the deterministic checks both pass; the scripts do not certify arbitrary prose structure or underlying content quality.

## Capabilities

- Clean existing Markdown
- Compose or export a new Markdown file
- Remove copied-agent conversation scaffolding
- Repair headings, lists, fences, and comparison tables when source intent is clear
- Map latent source structure before editing, then reconcile every clear signal before deterministic verification
- Preserve ambiguity instead of inventing a table schema, heading, list, or claim
- Maintain a document ledger and semantic handoff when long sources need bounded processing
- Preserve technical identifiers, URLs, and meaningful citations
- Format deterministically with Prettier as the sole final printer
- Validate with markdownlint and GFM checks before publishing
- Restore the original file if a Clean cannot be verified
- Avoid publishing failed Compose output

WolfMarkDown does not rewrite already-good prose for style, and it does not take over ordinary summaries or notes just because they could be written as Markdown.

## Requirements

Node.js 20 or newer is supported, including Node.js 22 and Node.js 24. Both the repository package and the WolfMarkDown runtime package declare `engines.node` as `>=20`.

## Compatibility

WolfMarkDown is model-agnostic. The same skill works with any agent host that can load Agent Skills from `.agents/skills/wolfmarkdown` or the Claude Code compatibility location `.claude/skills/wolfmarkdown`.

Examples include Codex, Cursor, Grok Build, Claude Code, OpenCode, Gemini CLI, Antigravity, and GitHub Copilot when their host enables the relevant Agent Skills discovery convention. It is one portable implementation, not a model-specific prompt or a set of vendor forks.

Slash-style `/wolfmarkdown` is harness-specific. Natural-language invocation works wherever the host loads the skill. The host model determines the quality of semantic judgement; WolfMarkDown supplies the same workflow, preservation rules, and deterministic checks across compatible hosts.

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

## Semantic repair

WolfMarkDown reconstructs headings, lists, tables, paragraphs, and sibling sections only when the source makes the structure clear. A headerless tab run is not automatically a table, a short sentence is not automatically a heading, and an isolated `Label: value` phrase is not automatically a list item.

For long documents, the agent maintains an internal document ledger and semantic handoff while it processes confirmed section boundaries. Before publishing, it reconciles the full outline, cross-section relationships, table boundaries, and protected values. If the source cannot be reviewed completely, it preserves uncertain material and reports the limit rather than guessing.

## Quality boundary

WolfMarkDown can establish source-grounded structure and verified Markdown properties. It does not fact-check claims, establish completeness or currency, assess policy compliance, or authorise public release. A WolfMarkDown PASS is Markdown-quality evidence, not content approval.

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

The Node suite protects the deterministic tooling and skill contract. Semantic evals are agent-executed structural rubrics: they assess whether an agent recovered or conservatively preserved the source structure, rather than comparing a brittle full-document snapshot.

## Limitations

- `/wolfmarkdown setup` only works after the skill is already discoverable.
- `--mode` is not supported.
- Vendor-specific skill copies are not created.
- Windows still needs permission to create a junction or symlink.
- Semantic sanitisation remains agent-judged.
- The verifier proves Markdown and content-integrity properties; it does not understand arbitrary prose or certify recovered semantic structure.
- Long-document repair depends on the agent retaining and reconciling its document ledger; incomplete source review must be reported rather than guessed.

## Licence

[MIT](./LICENSE)
