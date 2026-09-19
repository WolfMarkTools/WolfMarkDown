# Verification, integrity, and PASS

WolfMarkDown uses deterministic tooling to prove properties of a Markdown artifact after the agent has made the semantic decisions. A verification result is deliberately narrower than content approval.

## The quality boundary

> **A WolfMarkDown PASS is Markdown-quality evidence, not content approval.**

A PASS can provide evidence about the checks applicable to the operation, such as Markdown parsing, fence balance, lint, formatting, idempotence, destination protection, failed-output handling, and protected-token integrity when an untouched source snapshot is available.

A PASS does not establish:

- factual correctness;
- completeness;
- currency;
- policy compliance; or
- authorisation to publish.

Deterministic verification does not replace the agent's responsibility to make source-grounded semantic decisions or a human's responsibility to review important content.

## Verify

The verifier checks a file, directory, or standard input without composing or rewriting it:

```bash
node scripts/verify-markdown.mjs <file.md|dir|-> [--integrity-from <original.md>] [--preview] [--receipt <out.json>] [--json]
```

From the repository checkout, prefix the path with `wolfmarkdown/`:

```bash
node wolfmarkdown/scripts/verify-markdown.mjs path/to/file.md --json
```

Directories are scanned for Markdown files. `--integrity-from` applies to exactly one candidate file and cannot use standard input. A receipt must be written to a distinct path; it cannot overwrite the candidate or the integrity source.

## Receipts and previews

`--receipt` records durable evidence such as file hashes, WolfMarkDown and dependency versions, checks, issues, remediations, integrity coverage, and the quality boundary. `--json` emits the machine-readable result.

`--preview` inventories observable source and candidate structure, scaffolding, protected tokens, and whether content changed. A preview does not decide whether the agent's semantic repair was correct.

Clean and Compose use preview and receipt evidence before publishing. A failed Clean restores the original; a failed Compose does not publish the destination.

## Integrity comparison

When `--integrity-from` is supplied, WolfMarkDown extracts recognised token classes from an untouched source snapshot and checks that those exact values remain in the candidate. Integrity is a preservation check, not a proof that nothing changed: it does not count occurrences and it does not cover every technical value.

The current recognised classes are:

- HTTP(S) URLs;
- inline-code values and fenced-code bodies;
- Solana-style base58-shaped public keys and longer transaction-signature-shaped values;
- hex strings of at least 40 characters;
- three-part semantic versions, including prerelease and build metadata;
- relative, home-relative, POSIX absolute, and Windows drive-letter paths;
- environment names and assignments such as `API_KEY`, `$API_KEY`, `${API_KEY}`, and `API_KEY=`;
- ISO dates such as `2026-08-15` and numeric `dd/mm/yyyy` dates;
- percentages and `$`, `£`, or `€` currency amounts; and
- camelCase and snake_case identifiers.

The extractor intentionally does not currently protect:

- two-part versions such as `18.17`, `9.22`, or `11.0`;
- month-name dates such as `May 2027`; or
- isolated integers.

Verification reports these coverage limits as warnings where applicable. The agent must still preserve technical values that fall outside the extractor.

## Related detail

The skill's internal references describe [technical preservation](../wolfmarkdown/references/preservation.md), [semantic repair](../wolfmarkdown/references/semantic-repair.md), and [publish and restore rules](../wolfmarkdown/references/compose.md).
