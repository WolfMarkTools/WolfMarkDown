# WolfMarkDown

<!-- markdownlint-disable MD033 -->

> Keep the Markdown your agent produces. WolfMarkDown is an agent publishing workflow that turns messy AI output into professional Markdown you can review and keep — with proof, not hope.

Agent judgement for structure. Deterministic tooling for proof.

<p align="center">
  <a href="https://github.com/WolfMarkTools/WolfMarkDown/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/WolfMarkTools/WolfMarkDown"></a>
  <a href="./LICENSE"><img alt="MIT licence" src="https://img.shields.io/github/license/WolfMarkTools/WolfMarkDown"></a>
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <a href="https://github.com/WolfMarkTools/WolfMarkDown/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/WolfMarkTools/WolfMarkDown?style=social"></a>
</p>

Agents write useful research, plans, and documentation. They also flatten tables, skip headings, copy chat scaffolding, break fences, and quietly change identifiers.

WolfMarkDown is the publishing layer for that output:

- **Compose** a real `.md` file from source material, not a chat-shaped dump.
- **Clean** an existing file with the smallest semantic repair that still recovers clear structure.
- **Verify** before you keep it: formatting, parsing, lint, fences, integrity, and a written receipt.
- **Restore or refuse** if verification fails. Failed Clean puts the original back. Failed Compose does not publish.

The result is not a magical Markdown repair engine. The agent decides meaning. The scripts prove the artifact is safe to keep.

## Why this is not Prettier

Prettier is an excellent Markdown printer. It cannot decide whether a flattened block is a comparison table, whether a short sentence is a heading, or whether a copied agent message belongs in the document.

WolfMarkDown makes those decisions explicit and conservative. It repairs clear structure, preserves genuinely ambiguous material, and reports what was recovered. It does not fact-check the source or approve publication.

| Capability | Prettier alone | WolfMarkDown |
| --- | :-: | :-: |
| Deterministic Markdown formatting | Yes | Yes |
| Repair semantic document structure | No | Yes |
| Remove copied AI conversation scaffolding | No | Yes |
| Rebuild malformed comparison tables | No | Yes |
| Check recognised protected-token classes against a source snapshot | No | Yes |
| Verify GFM parsing and fence balance | No | Yes |
| Run markdownlint before publishing | No | Yes |
| Check idempotence | No | Yes |
| Restore the original after failed Clean | No | Yes |
| Refuse to publish failed Compose | No | Yes |
| Write a verification receipt and source-to-candidate preview | No | Yes |

WolfMarkDown does not rewrite already-good prose just to make it sound different. The goal is minimum necessary semantic cleanup with deterministic proof that the result is safe to keep.

## Install

Requires **Node.js 20 or newer**.

### Recommended: skills CLI

```bash
npx skills add WolfMarkTools/WolfMarkDown --skill wolfmarkdown
```

That installs the canonical `wolfmarkdown/` skill for the Agent Skills host you select. After install, reload the host if the skill does not appear immediately.

### Claude Code, non-interactive

```bash
npx skills add WolfMarkTools/WolfMarkDown \
  --skill wolfmarkdown \
  -g \
  -a claude-code \
  -y
```

### From a repository checkout

Use this when you are developing WolfMarkDown, or when you want the skill to track a local clone.

```bash
git clone https://github.com/WolfMarkTools/WolfMarkDown.git
cd WolfMarkDown
npm ci --prefix wolfmarkdown
node wolfmarkdown/scripts/install.mjs
```

The installer repairs runtime dependencies only when needed, links shared `~/.agents/skills/wolfmarkdown` discovery, links the Claude Code compatibility path, uses a directory junction on Windows when appropriate, and refuses to overwrite unrelated paths. Setup is idempotent: rerunning it on a healthy install does not reinstall dependencies.

Then ask the agent:

```text
WolfMarkDown doctor
```

Doctor inspects runtime and discovery. Local Clean, Compose, and Verify may proceed when runtime is healthy even if a global discovery link is missing.

## Update

How you update depends on how you installed.

### skills CLI install

```bash
npx skills update wolfmarkdown
```

Useful variants:

```bash
npx skills update wolfmarkdown -g    # global install
npx skills update wolfmarkdown -p    # project install
npx skills update -y                 # skip the scope prompt
```

Reload the host after a successful update so it picks up the new `SKILL.md`.

### Repository checkout

A checkout install is a discovery link into this clone. Updating the clone updates the skill:

```bash
git pull
npm ci --prefix wolfmarkdown
node wolfmarkdown/scripts/install.mjs
```

`npm ci` refreshes pinned runtime dependencies. `install.mjs` repairs the discovery links and only reinstalls packages when they are missing or the wrong version.

Confirm:

```text
WolfMarkDown doctor
```

or:

```bash
node wolfmarkdown/scripts/doctor.mjs
```

## Quick usage

Once the skill is installed, ask in natural language:

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
| **Compose** | Creates a real `.md` file from source material, removes chat-only scaffolding, formats it, verifies it with a preview and receipt, and publishes only after PASS. |
| **Clean** | Repairs an existing Markdown file with the smallest necessary semantic changes and restores the original if verification fails. |
| **Verify** | Checks Markdown without changing it. Directories, multiple files, and standard input are supported. |
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

## Examples

The public examples show WolfMarkDown recovering structure from real agent-shaped Markdown without inventing missing meaning.

- [Mobile App Migration Example](./examples/mobile-app-migration/README.md) — a complete before-and-after fixture covering chat-wrapper sanitisation, tab-separated tables, Unicode bullets, protected environment variables, and an intentionally ambiguous database note.
- [Raw input](./examples/mobile-app-migration/input.md) — the source AI output before repair.
- [Structured output](./examples/mobile-app-migration/output.md) — the resulting Markdown with headings, GFM tables, lists, and an `env` code block.

The example README records the OpenCode harness, `GLM-5.2` model, and exact prompt used for reproduction.

## What a PASS means

WolfMarkDown PASS is Markdown-quality evidence, not content approval. It means the artifact passed the applicable deterministic checks:

- the Markdown artifact passed formatting, parsing, lint, fence, and idempotence checks;
- the agent made and reported source-grounded structural decisions;
- recognised protected-token classes were preserved only when integrity was checked against an untouched source snapshot, as in Clean and Compose or with `--integrity-from`;
- failed Clean and Compose operations did not leave an unverified published result.

Standalone Verify without an integrity source reports integrity as skipped. Its PASS does not prove that protected tokens were preserved. The receipt still reports which token classes were recognised and warns about uncovered shapes such as two-part versions, month-name dates, and isolated integers. Those warnings do not fail verification.

WolfMarkDown does not fact-check claims. PASS does not establish factual correctness, completeness, currency, policy compliance, or authorisation to publish.

### Protected details

When an untouched source snapshot is available, integrity checks the token classes the extractor actually recognises. That is a closed list, not a promise to protect every version, date, number, or identifier. The current classes are:

- URLs, inline code, and fenced code bodies;
- matched base58-shaped public keys and signatures, and hex hashes of 40 or more characters;
- three-part semantic versions such as `1.2.3` and `v1.2.3-beta.1`;
- filesystem paths and environment names/assignments that match the extractor;
- ISO dates, numeric `dd/mm/yyyy` dates, percentages, and currency amounts;
- matched camelCase and snake_case identifier shapes.

It does not protect two-part versions such as `18.17`, month-name dates such as `May 2027`, or isolated integers. Matched identifier shapes can include incidental camelCase tokens.

Deterministic checks are proof of artifact properties. They are not a semantic oracle, and they do not replace the agent's responsibility to account for every clear source signal.

## What's in 1.0.0

1.0.0 is the publishing workflow, not a patch on 0.2.x:

- verification **receipts** with hashes, versions, checks, issues, and the quality boundary;
- **integrity coverage** warnings for shapes the extractor does not protect;
- a deterministic source-to-candidate **preview** before keep or publish;
- **batch Verify** for directories and multiple files;
- a long-document **scaffold** inventory the agent uses before it decides structure;
- atomic writes that refuse symlink destinations;
- standard-input Verify and Format;
- CI on Node 20, 22, and 24.

This is current-head evidence, not a claim that a GitHub release tag already exists.

### Current evidence

- Node tests pass on the current head.
- Executable semantic property checks cover headings, GFM tables, recognised protected tokens, conservative record-boundary preservation, and invented-table rejection.
- `skills-ref validate ./wolfmarkdown` passes.
- Installer, Doctor, rollback, target-collision, integrity, and idempotence checks remain covered.
- CI runs the test suite, skill validation, and public example on Node 20, 22, and 24.

### External-plugin intake

The immutable `v0.2.1` submission (`2323dd0f806f803dafd42e28a743d8ca7b6fd410`, [awesome-copilot#2676](https://github.com/github/awesome-copilot/issues/2676)) passed GitHub Awesome Copilot's complete automated external-plugin intake, including Agent Plugins specification compliance, Vally validation, a skill install smoke test, version matching, and immutable ref/SHA consistency. Human maintainer review remains pending. This is packaging evidence, not host acceptance, directory approval, or a claim that Awesome Copilot has accepted WolfMarkDown.

The earlier `v0.1.1` package also passed automated intake. That remains historical packaging evidence.

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

The agent reconstructs headings, lists, tables, paragraphs, and sibling sections only when the source makes the structure clear. A headerless tab run is not automatically a table, a short sentence is not automatically a heading, and an isolated `Label: value` phrase is not automatically a list item. When an ambiguous row-like run must stay non-tabular, each record is kept in printer-stable Markdown such as a list item or its own paragraph. For long documents, the agent maintains a source map and reconciles the full outline, cross-section relationships, table boundaries, and protected values before publishing. If the source cannot be reviewed completely, it preserves uncertainty and reports the limit rather than guessing.

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

The evaluator checks expected headings and table counts, recognised protected-token preservation, surviving record boundaries, and safety properties such as refusing to turn an ambiguous headerless run into a table. It does not infer or repair the candidate.

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
node wolfmarkdown/scripts/verify-markdown.mjs path/to/docs --json --preview
node wolfmarkdown/scripts/verify-markdown.mjs - --json
node wolfmarkdown/scripts/scaffold-markdown.mjs path/to/file.md --json
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

## Contributing

Found a Markdown edge case WolfMarkDown should handle better? [Open an issue](https://github.com/WolfMarkTools/WolfMarkDown/issues).

Pull requests are especially useful for reproducible Markdown failures, integrity edge cases, cross-platform installation issues, additional host acceptance evidence, and focused improvements that preserve the single-implementation architecture.

## Licence

WolfMarkDown is available under the [MIT Licence](./LICENSE).

## Support the project

<p align="center"><strong>Less cleanup after the agent. More Markdown you can ship.</strong></p>

<p align="center">If WolfMarkDown saves you from manually fixing AI-generated Markdown, <a href="https://github.com/WolfMarkTools/WolfMarkDown">star WolfMarkDown on GitHub</a> so other agent users can find it.</p>
