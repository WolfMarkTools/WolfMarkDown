# WolfMarkDown

<!-- markdownlint-disable MD033 -->

<p align="center"><strong>Production-ready Markdown from AI agents — created, cleaned, repaired, and verified.</strong></p>

<p align="center">Agent judgement for structure. Deterministic tooling for proof.</p>

<p align="center">
  <a href="https://github.com/WolfMarkTools/WolfMarkDown/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/WolfMarkTools/WolfMarkDown"></a>
  <a href="./LICENSE"><img alt="MIT licence" src="https://img.shields.io/github/license/WolfMarkTools/WolfMarkDown"></a>
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <a href="https://github.com/WolfMarkTools/WolfMarkDown/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/WolfMarkTools/WolfMarkDown?style=social"></a>
</p>

AI agents can produce excellent research, documentation, and plans while still leaving behind broken Markdown: malformed tables, inconsistent headings, copied chat scaffolding, unclosed fences, excess whitespace, or accidental changes to technical identifiers.

**WolfMarkDown is the output layer between an AI agent and the `.md` file you actually want to keep.**

It combines semantic agent judgement with deterministic formatting, linting, parsing, integrity checks, idempotence checks, and failure-safe publishing.

WolfMarkDown supports Node.js 20 or newer, including Node.js 22 and Node.js 24.

## Install in one command

```bash
npx skills add WolfMarkTools/WolfMarkDown --skill wolfmarkdown
```

Choose the agents and installation scope when prompted. WolfMarkDown follows the open Agent Skills model and uses one canonical implementation across compatible harnesses.

> If WolfMarkDown saves you from manually fixing AI-generated Markdown, consider [starring the repository](https://github.com/WolfMarkTools/WolfMarkDown). Stars help other agent users discover it.

## Why WolfMarkDown?

Prettier is an excellent Markdown printer. WolfMarkDown solves the parts that a printer cannot.

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
| Restore the original after a failed Clean | No | Yes |
| Refuse to publish a failed Compose | No | Yes |

WolfMarkDown does not rewrite already-good prose just to make it sound different. The goal is **minimum necessary semantic cleanup with deterministic proof that the result is safe to keep**.

## What it does

| Operation | What WolfMarkDown does |
| --- | --- |
| **Compose** | Creates a real `.md` file from source material, removes chat-only scaffolding, formats it, verifies it, then publishes it only after PASS. |
| **Clean** | Repairs an existing Markdown file with the smallest necessary semantic changes and restores the original if verification fails. |
| **Verify** | Checks Markdown without changing it. |
| **Doctor** | Inspects runtime dependencies and skill discovery without mutating the install. |
| **Setup** | Repairs runtime dependencies only when needed and configures shared skill discovery. |

### Typical cleanup targets

- heading hierarchy
- malformed or inconsistent lists
- broken GFM tables
- unclosed code fences
- excessive whitespace
- copied agent commentary such as “Here is the cleaned version”
- conversation-dependent wording that does not belong in a standalone document
- decorative noise that should not survive into production documentation

## Built to preserve the details that matter

Markdown cleanup is only useful if it does not silently damage technical content.

WolfMarkDown protects and verifies technical tokens including:

- URLs
- inline and fenced code
- Solana public keys and signatures
- long hexadecimal hashes
- semantic versions such as `1.2.3`, `v1.2.3`, prereleases, and build metadata
- filesystem paths
- contextual environment variables
- dates
- percentages
- currency values

Integrity is checked against the original source before a changed file is accepted.

## How it works

```text
User intent
    ↓
Agent semantic judgement
    ↓
Prettier
    ↓
markdownlint + GFM parse + source-aware fence checks
    ↓
Protected-token integrity
    ↓
Idempotence
    ↓
PASS → publish
FAIL → restore / do not publish
```

The split is deliberate:

- **The agent owns judgement** — intent, semantic structure, conversation sanitisation, table repair, and whether something is decorative or meaningful.
- **The scripts own proof** — formatting, linting, parsing, fence balance, protected-token integrity, idempotence, installation, and Doctor checks.

Prettier is the sole final printer.

## Semantic repair

WolfMarkDown reconstructs headings, lists, tables, paragraphs, and sibling sections only when the source makes the structure clear. A headerless tab run is not automatically a table, a short sentence is not automatically a heading, and an isolated `Label: value` phrase is not automatically a list item.

For long documents, the agent maintains an internal document ledger and semantic handoff while it processes confirmed section boundaries. Before publishing, it reconciles the full outline, cross-section relationships, table boundaries, and protected values. If the source cannot be reviewed completely, it preserves uncertain material and reports the limit rather than guessing.

## Quality boundary

A WolfMarkDown PASS is source-grounded evidence of structurally production-ready Markdown. It is Markdown-quality evidence, not content approval. It does not fact-check claims, establish completeness or currency, assess policy compliance, or authorise publication. Deterministic verification does not certify arbitrary prose; semantic judgement remains agent-owned.

## Use it

### Clean an existing document

```text
Use WolfMarkDown on docs/architecture.md.
```

### Compose a new Markdown file

```text
Export this research as Markdown using WolfMarkDown.
```

```text
Save this as docs/research/wallet-analysis.md using WolfMarkDown.
```

### Verify without changing anything

```text
Verify docs/architecture.md with WolfMarkDown.
```

### Check the installation

```text
Run WolfMarkDown doctor.
```

Where a harness exposes Agent Skills as slash commands, WolfMarkDown can also be invoked as `/wolfmarkdown`.

```text
/wolfmarkdown setup
/wolfmarkdown doctor
/wolfmarkdown docs/architecture.md
/wolfmarkdown verify docs/architecture.md
```

Slash-command presentation is harness-specific; natural-language invocation remains portable.

## Verification evidence

WolfMarkDown was released with both deterministic and agent-level verification rather than relying on example screenshots alone.

### WolfMarkDown v0.1.x

- **51/51 Node tests passed**
- **15/15 semantic evals passed**
- `skills-ref validate ./wolfmarkdown` — **Valid skill**
- installer idempotence — **PASS**
- Doctor checks — **PASS**
- protected-token integrity — **PASS**
- failure rollback — **PASS**
- discovery-link handling — **PASS**
- public remote install through `npx skills` — **verified**
- Claude Code global installation — **verified**

### GitHub Awesome Copilot external-plugin intake

The `v0.1.1` Agent Plugins package passed GitHub Awesome Copilot's automated external-plugin intake:

- Agent Plugins v1 spec compliance — **PASS**
- Vally lint — **PASS**
- skill file-reference validation — **PASS**
- Copilot plugin install smoke test — **PASS**
- version match — **PASS**
- immutable ref/SHA consistency — **PASS**

The submission is currently awaiting maintainer review in [github/awesome-copilot#2676](https://github.com/github/awesome-copilot/issues/2676).

## Compatibility

WolfMarkDown is model-agnostic. The same skill works with any agent host that can load Agent Skills from `.agents/skills/wolfmarkdown` or the Claude Code compatibility location `.claude/skills/wolfmarkdown`.

Examples include Codex, Cursor, Grok Build, Claude Code, OpenCode, Gemini CLI, Antigravity, and GitHub Copilot when their host enables the relevant Agent Skills discovery convention. It is one portable implementation, not a model-specific prompt or a set of vendor forks.

Slash-style `/wolfmarkdown` is harness-specific. Natural-language invocation works wherever the host loads the skill. The host model determines the quality of semantic judgement; WolfMarkDown supplies the workflow, preservation rules, and deterministic checks across compatible hosts.

The [`skills` CLI](https://github.com/vercel-labs/skills) can install Agent Skills across a broad set of supported agent harnesses.

## Installation details

### Recommended: `skills` CLI

Interactive install:

```bash
npx skills add WolfMarkTools/WolfMarkDown --skill wolfmarkdown
```

Example non-interactive Claude Code install:

```bash
npx skills add WolfMarkTools/WolfMarkDown \
  --skill wolfmarkdown \
  -g \
  -a claude-code \
  -y
```

### From a repository checkout

```bash
npm ci --prefix wolfmarkdown
node wolfmarkdown/scripts/install.mjs
```

The installer:

- installs or repairs runtime dependencies only when needed
- configures shared `~/.agents/skills/wolfmarkdown` discovery
- configures the Claude Code compatibility path at `~/.claude/skills/wolfmarkdown`
- uses a directory junction on Windows when appropriate
- refuses to overwrite unrelated foreign paths

Inside this repository, `.agents/skills/wolfmarkdown` points to the canonical `wolfmarkdown/` directory.

The Agent Plugins package follows the same principle: `skills/wolfmarkdown` points back to the same canonical implementation rather than maintaining a second copy.

## Architecture

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

The machine skill ID and filesystem directory are intentionally lowercase `wolfmarkdown`; the product name is **WolfMarkDown**.

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
node wolfmarkdown/scripts/verify-markdown.mjs path/to/file.md --json
```

Semantic cases live in `wolfmarkdown/tests/evals/`. Cross-agent acceptance inputs live in `wolfmarkdown/tests/acceptance/`.

The Node suite protects the deterministic tooling and skill contract. Semantic evals are agent-executed structural rubrics: they assess whether an agent recovered or conservatively preserved source structure, rather than comparing a brittle full-document snapshot.

## Current boundaries

- `/wolfmarkdown setup` only works after the skill is discoverable by the agent.
- `--mode` is not supported.
- vendor-specific behavioural forks are intentionally not created.
- Windows requires permission to create the appropriate discovery link or junction.
- semantic sanitisation remains agent-judged by design.
- The verifier proves Markdown and content-integrity properties; it does not understand arbitrary prose or certify recovered semantic structure.
- Long-document repair depends on the agent retaining and reconciling its document ledger; incomplete source review must be reported rather than guessed.

## Contributing

Found a Markdown edge case WolfMarkDown should handle better? [Open an issue](https://github.com/WolfMarkTools/WolfMarkDown/issues).

Pull requests are welcome, especially for:

- reproducible Markdown failure cases
- integrity edge cases
- cross-platform installation issues
- additional agent-harness acceptance evidence
- focused improvements that preserve the single-implementation architecture

## Licence

WolfMarkDown is available under the [MIT Licence](./LICENSE).

---

<p align="center"><strong>Less cleanup after the agent. More Markdown you can ship.</strong></p>

<p align="center">If that sounds useful, <a href="https://github.com/WolfMarkTools/WolfMarkDown">star WolfMarkDown on GitHub</a> and help other agent users find it.</p>
