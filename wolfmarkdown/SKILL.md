---
name: wolfmarkdown
description: >
  WolfMarkDown turns messy agent output into standalone Markdown you can keep.
  It composes, cleans, and verifies .md files: the agent decides structure;
  deterministic tooling proves formatting, parsing, integrity, and publication
  safety. A PASS is Markdown-quality evidence, not factual correctness or
  approval to publish.
license: MIT
compatibility: Requires Node.js 20+
metadata:
  author: WolfMark
  version: "1.0.0"
  display-name: WolfMarkDown
---

# WolfMarkDown

WolfMarkDown is the trusted Markdown output layer for an agent. When the user explicitly wants Markdown created, exported, saved, cleaned, repaired, polished, or validated, take responsibility for a clean, standalone, verified `.md` file.

## Quality boundary

A WolfMarkDown PASS means the agent has made source-grounded structural decisions and the resulting Markdown passed deterministic verification. It does not establish that the source is factually correct, complete, current, policy-compliant, or authorised for publication. Do not present Markdown quality as content approval.

Do not activate Compose merely because a normal answer could be written in Markdown. The fact that an answer could be represented in Markdown is not sufficient to trigger WolfMarkDown Compose. The user must explicitly request Markdown output, a `.md` file, export/save behaviour, or WolfMarkDown itself.

Do not take over requests such as "Summarise this", "Give me some notes", "Write an explanation", "Compare these options", "Give me a report", or "Write some documentation" unless they also ask for Markdown, a `.md` file, export/save of a Markdown file, or WolfMarkDown.

Judgement stays in this skill. Deterministic proof stays in the scripts.

Resolve every script path from this `SKILL.md` directory.

- `scripts/doctor.mjs`
- `scripts/install.mjs`
- `scripts/format-markdown.mjs`
- `scripts/verify-markdown.mjs`
- `scripts/scaffold-markdown.mjs`

Requires Node.js 20 or newer.

Load references only when the matching phase needs them.

## Slash command

Where the harness exposes Agent Skills as slash commands (Grok does), this skill is `/wolfmarkdown`. Codex and Cursor may not use the same slash UI; they still accept the natural-language forms below.

| Invocation                                       | Intent  |
| ------------------------------------------------ | ------- |
| `/wolfmarkdown setup` or `/wolfmarkdown install` | Setup   |
| `/wolfmarkdown doctor`                           | Doctor  |
| `/wolfmarkdown verify <file.md>`                 | Verify  |
| `/wolfmarkdown <file.md>`                        | Clean   |
| `/wolfmarkdown` plus export or write wording     | Compose |

Natural-language forms include Markdown cleanup, Markdown formatting, Markdown repair, format this Markdown, clean this Markdown, repair this Markdown, validate this Markdown, check this Markdown, malformed Markdown, copied agent conversation cleanup, malformed tables, .md cleanup, Markdown lint failures, export as Markdown, export as a Markdown file, present as Markdown, write as Markdown, write a Markdown file, create a Markdown file, create a .md, save this as Markdown, save this as .md, install WolfMarkDown, set up WolfMarkDown, and WolfMarkDown doctor.

## Intent

Pick exactly one.

- **Setup** — `/wolfmarkdown setup`, install WolfMarkDown, set up WolfMarkDown, make it available globally. Install or repair runtime dependencies if they are actually broken, install the shared `~/.agents/skills/wolfmarkdown` link and the Claude Code `~/.claude/skills/wolfmarkdown` compatibility link, run doctor, report, stop. Do not clean or compose.
- **Doctor** — `/wolfmarkdown doctor`, check WolfMarkDown, is it installed correctly. Run `node scripts/doctor.mjs`. Inspect only. Do not modify Markdown. Do not repair unless the user also asked to fix, set up, or install.
- **Verify** — check/validate/lint this Markdown but do not change it, `/wolfmarkdown verify <file>`. Run `verify-markdown.mjs` only. If the user says check and fix, that is Clean.
- **Clean** — clean, polish, fix formatting, or WolfMarkDown an existing `.md`. Minimum necessary semantic cleanup. Prefer a no-op when the file already conforms.
- **Compose** — export, present, write, create, or save as Markdown / a `.md` file. Create the actual file. Printing Markdown in chat does not fulfil a file-creation request.

## Preflight

Before Clean, Compose, or Verify, run a lightweight health check: `node scripts/doctor.mjs --json`.

- Decide local processing from `runtimeOk` only. If `runtimeOk` is true, continue. Do not use top-level `ok` or `overallOk` to decide whether Clean, Compose, or Verify may proceed.
- `ok` and `overallOk` are overall Doctor health (runtime and discovery together). They may be false when discovery is unhealthy even though local processing is available.
- `discoveryOk` is shared or project discovery only. An overall FAIL with `runtimeOk` true is a discovery finding, not a reason to stop local Clean, Compose, or Verify. Do not run `npm ci`. Do not treat a missing global discovery link as a reason to reinstall.
- If `runtimeOk` is false because dependencies are missing or the wrong version, run `node scripts/install.mjs` only as far as needed to repair runtime, then continue.
- A missing global link does not block project-local processing.

The user should not have to copy shell commands. Do not ask them to copy shell commands.

## Setup

1. Resolve `SKILL_DIR` as the directory that contains this `SKILL.md`.
2. Run `node scripts/install.mjs` from `SKILL_DIR`.
3. Run `node scripts/doctor.mjs`.
4. Report with the Setup template. Stop.

Rerunning setup is idempotent. Do not reinstall healthy dependencies.

`/wolfmarkdown setup` only works once an agent can already discover this skill. In this repository, `.agents/skills/wolfmarkdown` provides that. After setup, `~/.agents/skills/wolfmarkdown` is the shared user discovery link. `~/.claude/skills/wolfmarkdown` is the Claude Code compatibility link. Both resolve to this repository. A harness may need a reload before a newly installed global skill appears.

## Doctor

Run `node scripts/doctor.mjs` (add `--json` when a machine-readable result is easier). Doctor does not mutate the install.

Distinguish **runtime health** from **discovery health**. Report Runtime, Discovery, and Overall. `ok` and `overallOk` match Overall/Result. Local processing still follows `runtimeOk`.

## Verify

Do not sanitise, compose, or rewrite. Run:

`node scripts/verify-markdown.mjs <file.md|dir|-> [...] [--integrity-from <original.md>] [--preview] [--receipt <out.json>] [--json]`

Use `-` to read standard input. Directories are scanned recursively for `.md` files. `--integrity-from` is only valid with exactly one file and cannot be standard input. `--receipt` must be a distinct file; it cannot be the candidate, the integrity source, or standard input. Report PASS or FAIL with the verifier issues. `--json` and `--receipt` write a verification receipt: hashes, versions, checks, integrity coverage, issues with remediations, and the quality boundary. `--preview` adds a deterministic source-to-candidate inventory. Preview does not judge semantic decisions.

## Clean

Before formatting, inspect whether the source contains flattened semantic structure. A Prettier-valid document can still be a failed transformation if it has lost tables, headings, lists, or relationships. Do not let Prettier become the first structural transformation: make the agent-owned semantic decisions and recover clear structure before running the formatter.

1. Read the complete existing file.
2. Snapshot the original bytes to a unique OS temp file. Do not commit it. Do not overwrite it later.
3. Classify. Sanitise conversation scaffolding only when appropriate. See [conversation-sanitisation.md](references/conversation-sanitisation.md).
4. Run `node scripts/scaffold-markdown.mjs <snapshot> --json` on the snapshot. Build a source map from that inventory and use the long-document semantic handoff when needed. Classify Preserve, Restructure, Sanitise, Compose, and Unresolved yourself. The scaffold does not rewrite and is not semantic proof. Then repair the candidate and reconcile every clear signal by following [semantic-repair.md](references/semantic-repair.md). Apply [wolfmark-markdown-style.md](references/wolfmark-markdown-style.md) for Markdown conventions. Do not let a syntactically valid, Prettier-stable document substitute for recovered structure. Make the smallest semantic changes needed and do not rewrite already-good prose.
5. Write a candidate, format with `format-markdown.mjs`, then verify with `--integrity-from` the snapshot, `--preview`, `--receipt` to a temp JSON file, and `--json`. Do not keep or report PASS without that preview and receipt. Preview does not judge whether a semantic decision was correct.
6. If verification cannot pass, restore the original file from the snapshot before reporting FAIL. See [compose.md](references/compose.md) for publish/restore rules.
7. Confirm format `--check`. Report. Delete the temporary snapshot after the report, on both PASS and FAIL. Do not refresh the snapshot from the edited file.

## Compose workflow

See [compose.md](references/compose.md) and [preservation.md](references/preservation.md). Do not invent citation URLs or source titles.

1. Identify source material. Snapshot it exactly in OS temp storage.
2. Choose the output path: honour an explicit path; otherwise infer a kebab-case `.md` name, using an established `docs/` directory when that convention is obvious, otherwise the current working directory. Do not invent a deep folder tree. Do not keep asking for a filename when one is obvious.
3. If the target already exists and the user did not clearly authorise replace/update, do not overwrite it.
4. Compose a standalone document. Derive a concise H1 from the source unless the user asked for a fragment, README section, or insert. Do not add YAML frontmatter unless requested, already present, or required by an obvious repo convention.
5. Remove chat-only scaffolding and convert conversation-dependent language into document language. Do not fabricate missing context or citation URLs.
6. Run `node scripts/scaffold-markdown.mjs <snapshot> --json` on the snapshot. Use that inventory as the source map and the long-document semantic handoff when needed. Classify Preserve, Restructure, Sanitise, Compose, and Unresolved yourself. Then repair the candidate and reconcile every clear signal by following [semantic-repair.md](references/semantic-repair.md). Apply [wolfmark-markdown-style.md](references/wolfmark-markdown-style.md) for Markdown conventions. Semantic judgement remains agent-owned and deterministic scripts remain proof only.
7. Write a temporary candidate, format it, and verify it against the source snapshot with `--integrity-from`, `--preview`, `--receipt` to a temp JSON file, and `--json`. Do not publish or report PASS without that preview and receipt. Preview does not decide whether a semantic repair was correct.
8. Publish to the destination only after PASS. Do not leave an unverified file at the destination. Clean up temporary files.

## Report

```text
WolfMarkDown
Operation: Setup
Runtime: Pass|Fail
Global discovery: Pass|Fail
Result: PASS|FAIL
```

```text
WolfMarkDown
Operation: Doctor
Runtime: Pass|Fail
Dependencies: Pass|Fail
Global discovery: Pass|Fail
Overall: PASS|FAIL
Result: PASS|FAIL
```

```text
WolfMarkDown
Operation: Verify
File: <path>
...
Result: PASS|FAIL
```

```text
WolfMarkDown
Operation: Clean
File: <path>
Semantic structure: Pass|Fail
Source scope: Complete|Chunked (<reviewed boundaries>)
Semantic handoff: Complete|<remaining reconciliation>
Semantic evidence: <source-grounded headings/tables/lists/paragraphs summary>
Unresolved ambiguities: None|<concise description>
Conversation sanitisation: Pass|Skipped|Fail
Heading hierarchy: Pass|Fail
Tables: <n rebuilt>|Unchanged
Lists: Normalised|Unchanged
Whitespace: Normalised|Unchanged
Prettier: Pass|Fail
markdownlint: Pass|Fail
GFM parse: Pass|Fail
Content integrity: Pass|Fail
Idempotence: Pass|Fail
Result: PASS|FAIL
```

```text
WolfMarkDown
Operation: Compose
Output: <path>
Semantic structure: Pass|Fail
Source scope: Complete|Chunked (<reviewed boundaries>)
Semantic handoff: Complete|<remaining reconciliation>
Semantic evidence: <source-grounded headings/tables/lists/paragraphs summary>
Unresolved ambiguities: None|<concise description>
Conversation sanitisation: Pass|Skipped|Fail
Heading hierarchy: Pass|Fail
Tables: <n created>|Unchanged
Lists: Normalised|Unchanged
Whitespace: Normalised|Unchanged
Prettier: Pass|Fail
markdownlint: Pass|Fail
GFM parse: Pass|Fail
Content integrity: Pass|Fail
Idempotence: Pass|Fail
Result: PASS|FAIL
```

Do not report invented metrics. No decorative status symbols.

## Red flags

Do not report PASS if verify was skipped, verify exited non-zero, Clean or Compose skipped `--preview` or `--receipt`, the target was edited before the snapshot, the edited file was used as `--integrity-from`, a failed Clean left a changed file, a failed Compose published the destination, a code block was sanitised, a protected token was dropped, a legitimate transcript was removed, code was rewritten, a citation URL was invented, the report introduced decorative emoji, the source scope was incomplete without disclosure, or the user was asked to run install or npm commands themselves. Do not claim that PASS validates the source's factual correctness or publication readiness.
