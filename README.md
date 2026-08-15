# WolfMarkDown

<!-- markdownlint-disable MD033 -->

> An agent publishing workflow for turning messy AI output into professional Markdown that is ready to review and keep.

Agent judgement for structure. Deterministic tooling for proof.

<p align="center">
  <a href="https://github.com/WolfMarkTools/WolfMarkDown/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/WolfMarkTools/WolfMarkDown"></a>
  <a href="./LICENSE"><img alt="MIT licence" src="https://img.shields.io/github/license/WolfMarkTools/WolfMarkDown"></a>
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <a href="https://github.com/WolfMarkTools/WolfMarkDown/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/WolfMarkTools/WolfMarkDown?style=social"></a>
</p>

AI agents can produce useful research, plans, and documentation while leaving behind flattened comparisons, inconsistent headings, copied chat scaffolding, broken fences, and altered technical identifiers.

WolfMarkDown gives the agent a disciplined publishing workflow:

- the agent decides meaning, structure, sanitisation, and composition;
- deterministic tooling formats and validates the resulting Markdown;
- protected content, rollback, and publication boundaries are checked before the result is kept.

The result is not a magical Markdown repair engine. It is an agent workflow with deterministic proof around the artifact.

## Why WolfMarkDown exists

Prettier is an excellent Markdown printer. It cannot decide whether a flattened block contains a comparison table, whether a short sentence is a heading, or whether a copied agent message belongs in the document.

WolfMarkDown makes those decisions explicit and conservative. It repairs clear structure, preserves genuinely ambiguous material, and reports what was recovered. It does not fact-check the source or approve publication.

| Capability | Prettier alone | WolfMarkDown |
| --- | :-: | :-: |
| Deterministic Markdown formatting | Yes | Yes |
| Repair semantic document structure | No | Yes |
| Remove copied AI conversation scaffolding | No | Yes |
| Rebuild malformed comparison tables | No | Yes |
| Protect URLs, code, hashes, versions, and identifiers | No | Yes |
| Verify GFM parsing and fence balance | No | Yes |
| Run markdownlint before publishing | No | Yes |
| Check idempotence | No | Yes |
| Restore the original after failed Clean | No | Yes |
| Refuse to publish failed Compose | No | Yes |

WolfMarkDown does not rewrite already-good prose just to make it sound different. The goal is minimum necessary semantic cleanup with deterministic proof that the result is safe to keep.

## Install

```bash
npx skills add WolfMarkTools/WolfMarkDown --skill wolfmarkdown
```

The `skills` CLI installs the canonical `wolfmarkdown/` skill for the selected Agent Skills-compatible host. A repository checkout can also run:

```bash
npm ci --prefix wolfmarkdown
node wolfmarkdown/scripts/install.mjs
```

For a non-interactive Claude Code install:

```bash
npx skills add WolfMarkTools/WolfMarkDown \
  --skill wolfmarkdown \
  -g \
  -a claude-code \
  -y
```

The installer repairs runtime dependencies only when needed, configures shared `.agents/skills/wolfmarkdown` discovery, configures the Claude Code compatibility path, uses a directory junction on Windows when appropriate, and refuses to overwrite unrelated paths.

## Quick usage

```text
Use WolfMarkDown on docs/architecture.md.
```

```text
Export this research as Markdown using WolfMarkDown.
```

```text
Verify docs/architecture.md with WolfMarkDown without changing it.
```

Where a host exposes slash commands, the same workflow may be invoked as:

```text
/wolfmarkdown docs/architecture.md
/wolfmarkdown verify docs/architecture.md
```

Natural-language invocation is the portable interface. Slash-command presentation is host-specific.

### Operations

| Operation | What WolfMarkDown does |
| --- | --- |
| **Compose** | Creates a real `.md` file from source material, removes chat-only scaffolding, formats it, verifies it, and publishes only after PASS. |
| **Clean** | Repairs an existing Markdown file with the smallest necessary semantic changes and restores the original if verification fails. |
| **Verify** | Checks Markdown without changing it. |
| **Doctor** | Inspects runtime dependencies and skill discovery without mutating the install. |
| **Setup** | Repairs runtime dependencies only when needed and configures shared skill discovery. |

Typical cleanup targets include heading hierarchy, malformed lists, broken GFM tables, unclosed code fences, copied agent commentary, conversation-dependent wording, and decorative noise that should not survive into documentation.

## Before and after

A messy agent draft may flatten a comparison into one block:

```text
Recommendation use relay_v2 for the external wallet flow.
Comparison Provider Mode Risk Privy External approval Medium CDP Embedded wallet High.
Implementation notes relay_v2 confirms getTransaction after submission.
```

After the agent makes the structure explicit, WolfMarkDown can publish a document such as:

```markdown
# Wallet flow decision

## Recommendation

Use `relay_v2` for the external wallet flow.

## Comparison

| Provider | Mode | Risk |
| --- | --- | --- |
| Privy | External approval | Medium |
| CDP | Embedded wallet | High |

## Implementation notes

`relay_v2` confirms `getTransaction` after submission.
```

The output recovers a table and headings, preserves the technical identifiers, and adds no information that was absent from the source. This is an illustrative structural example; semantic judgement remains agent-owned.

## Supported-agent integration status

WolfMarkDown has one canonical implementation. The table distinguishes repository-tested discovery paths from host acceptance that still needs a dedicated smoke test.

| Host | Integration status | Discovery path |
| --- | --- | --- |
| Codex | Repository discovery and installer path tested | Shared `.agents/skills` |
| Cursor | Repository discovery and installer path tested | Shared `.agents/skills` |
| Claude Code | Compatibility-link path tested | `.claude/skills` |
| OpenCode | Host acceptance pending | Shared `.agents/skills` when enabled by the host |
| Gemini CLI | Host acceptance pending | Shared `.agents/skills` when enabled by the host |
| GitHub Copilot | Host acceptance pending; plugin intake is historical evidence | Agent Skills or plugin support enabled by the host |

Host acceptance is not inferred from the presence of a binary or directory. The host model determines semantic quality; WolfMarkDown supplies the workflow and deterministic checks.

## How it works

```text
User intent
    ↓
Agent semantic judgement
    ↓
Source map and semantic repair
    ↓
GFM parse + heading/table checks
    ↓
Fence, frontmatter + whitespace checks
    ↓
Prettier format check
    ↓
markdownlint
    ↓
Protected-token integrity (with a source snapshot) + idempotence
    ↓
PASS → keep or publish     FAIL → restore or do not publish
```

Before formatting, the agent checks for flattened semantic structure. A document can be valid Markdown and still be a failed transformation if it lost tables, headings, lists, or relationships.

### Semantic repair boundary

The agent reconstructs headings, lists, tables, paragraphs, and sibling sections only when the source makes the structure clear. A headerless tab run is not automatically a table, a short sentence is not automatically a heading, and an isolated `Label: value` phrase is not automatically a list item. For long documents, the agent maintains a source map and reconciles the full outline, cross-section relationships, table boundaries, and protected values before publishing. If the source cannot be reviewed completely, it preserves uncertainty and reports the limit rather than guessing.

## Verification and quality boundary

WolfMarkDown PASS means the artifact passed the applicable deterministic checks:

- the Markdown artifact passed formatting, parsing, lint, fence, and idempotence checks;
- the agent made and reported source-grounded structural decisions;
- protected technical content was preserved only when integrity was checked against an untouched source snapshot, as in Clean and Compose or with `--integrity-from`;
- failed Clean and Compose operations did not leave an unverified published result.

Standalone Verify without an integrity source reports integrity as skipped. Its PASS does not prove that protected tokens were preserved.

### Protected details

When an untouched source snapshot is available, integrity checks protect technical content including:

- URLs, inline code, and fenced code;
- public keys, signatures, hashes, versions, and identifiers;
- filesystem paths and contextual environment variables;
- dates, percentages, and currency values.

This is Markdown-quality evidence, not content approval. PASS does not establish factual correctness, completeness, currency, policy compliance, or authorisation to publish. It does not fact-check claims.

Deterministic checks are proof of artifact properties. They are not a semantic oracle, and they do not replace the agent's responsibility to account for every clear source signal.

### v0.2.1 release evidence

- **82/82 Node tests pass.**
- Executable semantic property checks cover headings, GFM tables, protected tokens, and ambiguous-table preservation.
- `skills-ref validate ./wolfmarkdown` passes.
- Installer, Doctor, rollback, target-collision, integrity, and idempotence checks remain covered.

### Historical external-plugin intake

The `v0.1.1` Agent Plugins package passed GitHub Awesome Copilot's automated external-plugin intake. This is historical packaging evidence, not host acceptance evidence for v0.2.1.

## Architecture details

```text
WolfMarkDown/
├── plugin.json
├── .agents/
│   └── skills/
│       └── wolfmarkdown → ../../wolfmarkdown
├── skills/
│   └── wolfmarkdown → ../wolfmarkdown
└── wolfmarkdown/
    ├── SKILL.md
    ├── config/
    ├── lib/
    ├── references/
    ├── scripts/
    └── tests/
```

### Agent-owned decisions

The agent owns intent routing, source mapping, semantic classification, conversation sanitisation, heading/list/table recovery, ambiguity handling, and composition.

### Deterministic proof

The scripts own formatting, Markdown lint, GFM parsing, fence balance, frontmatter checks, protected-token integrity, idempotence, installation, Doctor checks, rollback, and property-based semantic evaluation. They do not rewrite source meaning.

Prettier is the sole final printer.

The machine skill ID and filesystem directory are intentionally lowercase `wolfmarkdown`; the product name is **WolfMarkDown**.

### Semantic evaluations

The evaluation corpus uses synthetic documents and structural properties rather than brittle full-document snapshots. Run a case against an agent-produced candidate after the normal verifier:

```bash
node wolfmarkdown/scripts/evaluate-semantic.mjs \
  --case ambiguous-structure-preservation \
  source.md candidate.md
```

The evaluator checks expected headings and table counts, protected-token preservation, and safety properties such as refusing to turn an ambiguous headerless run into a table. It does not infer or repair the candidate.

## Developer commands

```bash
npm ci --prefix wolfmarkdown
npm test
npx --yes skills-ref validate ./wolfmarkdown
```

Useful direct commands:

```bash
node wolfmarkdown/scripts/doctor.mjs
node wolfmarkdown/scripts/format-markdown.mjs path/to/file.md
node wolfmarkdown/scripts/verify-markdown.mjs path/to/file.md
node wolfmarkdown/scripts/evaluate-semantic.mjs --help
```

Semantic cases live in `wolfmarkdown/tests/evals/`. Cross-host acceptance inputs live in `wolfmarkdown/tests/acceptance/`.

## Current boundaries

- `/wolfmarkdown setup` only works after the skill is discoverable by the host.
- `--mode` is not supported.
- Vendor-specific skill forks are not created.
- Windows requires permission to create the appropriate discovery junction.
- Semantic sanitisation remains agent-judged by design.
- The verifier proves Markdown artifact properties; it does not certify arbitrary prose or publication readiness.
- Long-document repair depends on the agent retaining and reconciling its document ledger; incomplete source review must be reported rather than guessed.

## Repository metadata

Recommended GitHub repository topics:

`ai-agents` `agent-skills` `markdown` `documentation` `claude-code` `codex` `cursor` `github-copilot`

Topics should be configured in the GitHub repository settings. They are discoverability metadata, not compatibility evidence.

## Contributing

Found a Markdown edge case WolfMarkDown should handle better? [Open an issue](https://github.com/WolfMarkTools/WolfMarkDown/issues).

Pull requests are especially useful for reproducible Markdown failures, integrity edge cases, cross-platform installation issues, additional host acceptance evidence, and focused improvements that preserve the single-implementation architecture.

## Licence

WolfMarkDown is available under the [MIT Licence](./LICENSE).

## Support the project

<p align="center"><strong>Less cleanup after the agent. More Markdown you can ship.</strong></p>

<p align="center">If WolfMarkDown saves you from manually fixing AI-generated Markdown, <a href="https://github.com/WolfMarkTools/WolfMarkDown">star WolfMarkDown on GitHub</a> so other agent users can find it.</p>
