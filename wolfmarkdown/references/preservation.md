# Technical preservation

Treat supplied source as potentially private or live operational research. Keep snapshots in OS temporary storage only; never commit a user-provided source, failed output, wallet address, transaction signature, or other live identifier merely to reproduce a formatting failure. Public regression fixtures must be synthetic or explicitly redacted while retaining the structural signal under test. Synthetic or redacted failed-output evidence is permitted when it contains no live research, secrets, or identifiers and exists only to document a failure pattern.

Integrity compares the snapshot with the final document by protected-token class and occurrence. Each actual appearance contributes once to its class count: prose, code spans, link targets, frontmatter values, and embedded HTML are each scanned a single time. Tokens in always-protected classes, exact code spans, and scoped variable forms must still appear unchanged, or verification fails. Identifiers that appear only in ordinary prose are reported as warnings rather than failures, and a protected token that survives fewer times than before is also reported as a warning. Additional tokens are always allowed.

The verifier compares the snapshot with `verify-markdown.mjs --integrity-from <snapshot>`.

## Recognised protected-token classes

The extractor matches these classes only:

- URLs, exact
- Inline-code values, including their code-span markers, and fenced code bodies, allowing harmless fence-marker formatting
- Solana-style base58 public keys, typically 32-44 characters
- Longer base58 transaction signatures, including ~88-character values
- Hex hashes of 40 or more characters
- Three-part semantic versions, including `1.2.3`, `v1.2.3`, `1.2.3-beta.1`, and `v1.2.3+build.7`
- Path-like strings starting `./`, `../`, `~/`, a POSIX absolute path with at least one directory, a relative file path with an extension such as `docs/config.md`, a multi-segment relative path such as `docs/api/tokens`, or a Windows drive-letter path such as `C:\Users\mark\notes.md`
- Scoped environment forms that match the extractor: `$API_KEY` and `${API_KEY}`
- Environment names backed by code spans, and assignment shapes such as `API_KEY=` where the trailing `=` is part of the protected token, so dropping it fails verification
- ISO dates such as `2026-08-15` and numeric dates such as `15/08/2026`
- Percentages such as `12%` and `12 %`
- Currency amounts such as `$4.00`, `$1,000`, `£4.00`, and `€4.00`
- camelCase and snake_case identifiers backed by code spans, such as `` `getTransaction` ``
- Image descriptions, scanned once as ordinary prose

Identifiers that match camelCase, snake_case, or bare environment-name shapes but appear only in ordinary prose are not failures when changed; they are reported as `possibly-changed-prose-token` warnings for the agent to review. A protected token that still appears but fewer times than in the snapshot is reported as a `decreased-protected-token-count` warning. When a decreased token appears alongside a newly introduced token of the same class, the pair is treated as an unauthorised change and fails verification, since an entire occurrence disappearing is only ever a warning while a same-class replacement reads as a mutation. There is no removal-permit mechanism: an explicitly intended change to a strongly protected value still fails so the agent reconciles it deliberately.

## Do not protect

These are outside the current extractor even when they look technical:

- Two-part versions such as `18.17`, `9.22`, or `11.0`
- Month-name dates such as `May 2027`
- Isolated integers such as `30000`
- Headings such as `CURRENT VERDICT`
- Ordinary slash-containing prose without a file extension or multiple segments, such as `and/or`
- Short hex fragments

## Citations

Preserve Markdown links, URLs, source lists, valid footnote-like references, and factual attribution.

Do not invent citation URLs or source titles.

If the source uses agent-only citation markers that do not work in standalone Markdown, convert them only when the underlying URL or source text is available. Otherwise keep useful attribution conservatively and mention the portability limit in the completion report.

Do not change a technical value because it looks unusual. Do not normalise identifier case.
