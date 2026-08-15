# WolfMarkDown

<!-- markdownlint-disable MD033 -->

> An agent publishing workflow for turning messy AI output into professional Markdown that is ready to review and keep.

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

## Install

```bash
npx skills add WolfMarkTools/WolfMarkDown --skill wolfmarkdown
```

The `skills` CLI installs the canonical `wolfmarkdown/` skill for the selected Agent Skills-compatible host. A repository checkout can also run:

```bash
npm ci --prefix wolfmarkdown
node wolfmarkdown/scripts/install.mjs
```

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

The skill has one canonical implementation. The table distinguishes repository-tested discovery paths from host acceptance that still needs a dedicated smoke test.

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
Prettier
    ↓
markdownlint + GFM parse + fence checks
    ↓
Protected-token integrity + idempotence
    ↓
PASS → keep or publish     FAIL → restore or do not publish
```

Before formatting, the agent checks for flattened semantic structure. A document can be valid Markdown and still be a failed transformation if it lost tables, headings, lists, or relationships.

## Verification and quality boundary

WolfMarkDown PASS means:

- the Markdown artifact passed deterministic formatting, parsing, lint, fence, integrity, and idempotence checks;
- the agent made and reported source-grounded structural decisions;
- protected technical content was preserved;
- failed Clean and Compose operations did not leave an unverified published result.

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

If WolfMarkDown saves you from manually fixing AI-generated Markdown, [star WolfMarkDown on GitHub](https://github.com/WolfMarkTools/WolfMarkDown) so other agent users can find it.
