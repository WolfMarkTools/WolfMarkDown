---
name: wolfmarkdown
description: >
  Use when the user asks for WolfMarkDown, /wolfmarkdown, /wolfmarkdown setup,
  /wolfmarkdown doctor, Markdown cleanup, Markdown formatting, Markdown repair,
  format this Markdown, clean this Markdown, repair this Markdown,
  validate this Markdown, check this Markdown, malformed Markdown,
  badly formatted research, AI-generated research cleanup,
  copied agent conversation cleanup, documentation formatting, malformed tables,
  .md cleanup, Markdown lint failures, export as Markdown,
  export as a Markdown file, present as Markdown, write as Markdown,
  write a Markdown file, create a Markdown file, create a .md,
  save this as Markdown, save this as .md, install WolfMarkDown,
  set up WolfMarkDown, or WolfMarkDown doctor.
---

# WolfMarkDown

WolfMarkDown is the trusted Markdown output layer for an agent. When the user explicitly wants Markdown created, exported, saved, cleaned, repaired, polished, or validated, take responsibility for a clean, standalone, verified `.md` file.

Do not activate Compose merely because a normal answer could be written in Markdown. The fact that an answer could be represented in Markdown is not sufficient to trigger WolfMarkDown Compose. The user must explicitly request Markdown output, a `.md` file, export/save behaviour, or WolfMarkDown itself.

Do not take over requests such as "Summarise this", "Give me some notes", "Write an explanation", "Compare these options", "Give me a report", or "Write some documentation" unless they also ask for Markdown, a `.md` file, export/save of a Markdown file, or WolfMarkDown.

Judgement stays in this skill. Deterministic proof stays in the scripts.

Resolve every script path from this `SKILL.md` directory.

- `scripts/doctor.mjs`
- `scripts/install.mjs`
- `scripts/format-markdown.mjs`
- `scripts/verify-markdown.mjs`

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

## Intent

Pick exactly one.

- **Setup** — `/wolfmarkdown setup`, install WolfMarkDown, set up WolfMarkDown, make it available globally. Install or repair runtime dependencies if they are actually broken, install the shared `~/.agents/skills/wolfmarkdown` link and the Claude Code `~/.claude/skills/wolfmarkdown` compatibility link, run doctor, report, stop. Do not clean or compose.
- **Doctor** — `/wolfmarkdown doctor`, check WolfMarkDown, is it installed correctly. Run `node scripts/doctor.mjs`. Inspect only. Do not modify Markdown. Do not repair unless the user also asked to fix, set up, or install.
- **Verify** — check/validate/lint this Markdown but do not change it, `/wolfmarkdown verify <file>`. Run `verify-markdown.mjs` only. If the user says check and fix, that is Clean.
- **Clean** — clean, polish, fix formatting, or WolfMarkDown an existing `.md`. Minimum necessary semantic cleanup. Prefer a no-op when the file already conforms.
- **Compose** — export, present, write, create, or save as Markdown / a `.md` file. Create the actual file. Printing Markdown in chat does not fulfil a file-creation request.

## Preflight

Before Clean, Compose, or Verify, run a lightweight health check: `node scripts/doctor.mjs --json`.

- If **runtime** is healthy, continue. Do not run `npm ci`. Do not treat a missing global discovery link as a reason to reinstall.
- If **runtime** dependencies are missing or the wrong version, run `node scripts/install.mjs` only as far as needed to repair runtime, then continue.
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

Distinguish **runtime health** from **discovery health**. Report both.

## Verify

Do not sanitise, compose, or rewrite. Run:

`node scripts/verify-markdown.mjs <file> [--json]`

Report PASS or FAIL with the verifier errors.

## Clean

1. Read the complete existing file.
2. Snapshot the original bytes to a unique OS temp file. Do not commit it. Do not overwrite it later.
3. Classify. Sanitise conversation scaffolding only when appropriate. See [conversation-sanitisation.md](references/conversation-sanitisation.md).
4. Build a source map, repair the candidate, and reconcile every clear signal by following [semantic-repair.md](references/semantic-repair.md). Apply [wolfmark-markdown-style.md](references/wolfmark-markdown-style.md) for Markdown conventions. Do not let a syntactically valid, Prettier-stable document substitute for recovered structure. Make the smallest semantic changes needed and do not rewrite already-good prose.
5. Write a candidate, format with `format-markdown.mjs`, verify with `--integrity-from` the snapshot.
6. If verification cannot pass, restore the original file from the snapshot before reporting FAIL. See [compose.md](references/compose.md) for publish/restore rules.
7. Confirm format `--check`. Report. Delete the temporary snapshot after the report, on both PASS and FAIL. Do not refresh the snapshot from the edited file.

## Compose workflow

See [compose.md](references/compose.md) and [preservation.md](references/preservation.md). Do not invent citation URLs or source titles.

1. Identify source material. Snapshot it exactly in OS temp storage.
2. Choose the output path: honour an explicit path; otherwise infer a kebab-case `.md` name, using an established `docs/` directory when that convention is obvious, otherwise the current working directory. Do not invent a deep folder tree. Do not keep asking for a filename when one is obvious.
3. If the target already exists and the user did not clearly authorise replace/update, do not overwrite it.
4. Compose a standalone document. Derive a concise H1 from the source unless the user asked for a fragment, README section, or insert. Do not add YAML frontmatter unless requested, already present, or required by an obvious repo convention.
5. Remove chat-only scaffolding and convert conversation-dependent language into document language. Do not fabricate missing context or citation URLs.
6. Build a source map, repair the candidate, and reconcile every clear signal by following [semantic-repair.md](references/semantic-repair.md). Apply [wolfmark-markdown-style.md](references/wolfmark-markdown-style.md) for Markdown conventions. Semantic judgement remains agent-owned and deterministic scripts remain proof only.
7. Write a temporary candidate, format it, and verify it against the source snapshot.
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

Do not report PASS if verify was skipped, verify exited non-zero, the target was edited before the snapshot, the edited file was used as `--integrity-from`, a failed Clean left a changed file, a failed Compose published the destination, a code block was sanitised, a protected token was dropped, a legitimate transcript was removed, code was rewritten, a citation URL was invented, the report introduced decorative emoji, or the user was asked to run install or npm commands themselves.
