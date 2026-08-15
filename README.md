# WolfMarkDown

WolfMarkDown is a cross-agent Markdown output and repair skill that creates, cleans, sanitises, formats, and verifies production-ready Markdown.

It is the trusted Markdown output layer for an agent: when you explicitly want a `.md` file created, exported, saved, cleaned, or validated, WolfMarkDown takes responsibility for a standalone, verified result.

## Capabilities

- Clean existing Markdown
- Compose or export a new Markdown file
- Remove copied-agent conversation scaffolding
- Repair headings, lists, fences, and comparison tables when the intent is clear
- Preserve technical identifiers, URLs, and meaningful citations
- Format deterministically with Prettier
- Validate with markdownlint and GFM checks before publishing
- Restore the original file if a Clean cannot be verified
- Avoid publishing failed Compose output

WolfMarkDown does not rewrite already-good prose for style, and it does not take over ordinary summaries or notes just because they could be written as Markdown.

## Supported agents

One implementation. Agent-specific paths are discovery links only.

| Agent | Support | Discovery | Evidence |
| --- | --- | --- | --- |
| Codex | Tier 1 | Shared Agent Skills | Standard-compatible; `codex` detected on the authoring machine |
| Cursor | Tier 1 | Shared Agent Skills | Standard-compatible; `~/.cursor` detected |
| Grok Build | Tier 1 | Shared Agent Skills | Tested in this repository |
| Claude Code | Tier 1 | Claude compatibility link | Standard-compatible; `claude` detected |
| OpenCode | Tier 1 | Shared Agent Skills | Standard-compatible; acceptance pending |
| Gemini CLI | Tier 1 | Shared Agent Skills | Standard-compatible; acceptance pending |
| Antigravity | Tier 1 | Project/shared Agent Skills | Standard-compatible; acceptance pending |
| GitHub Copilot | Tier 2 | Shared Agent Skills | Standard-compatible; not acceptance-tested |

Slash-style `/wolfmarkdown` is harness-specific (Grok, sometimes Claude). Other agents should be invoked in natural language.

## Installation

The Agent Skills directory name must match `wolfmarkdown`, so the implementation lives in `wolfmarkdown/` rather than the repository root. `skills-ref validate` rejects a root-level `SKILL.md` because this repository is named `WolfMarkDown`.

From a checkout of this repository:

```bash
npm ci --prefix wolfmarkdown
node wolfmarkdown/scripts/install.mjs
```

From the repository root, `npm test` delegates to that directory.

That command:

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

The agent owns judgement: intent, conversation sanitisation, decorative versus substantive emoji, structure, and composition.

Scripts own deterministic proof: GFM parse, Prettier, markdownlint, fence balance, frontmatter, protected-token integrity, idempotence, install, and doctor.

Prettier is the only final printer.

## Development

```bash
npm ci --prefix wolfmarkdown
npm test
npx --yes skills-ref validate ./wolfmarkdown
```

After push, the expected skills CLI form to verify is:

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

## Licence

[MIT](./LICENSE)
