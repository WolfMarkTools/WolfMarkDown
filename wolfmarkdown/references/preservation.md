# Technical preservation

Treat supplied source as potentially private or live operational research. Keep snapshots in OS temporary storage only; never commit a user-provided source, failed output, wallet address, transaction signature, or other live identifier merely to reproduce a formatting failure. Public regression fixtures must be synthetic or explicitly redacted while retaining the structural signal under test. Synthetic or redacted failed-output evidence is permitted when it contains no live research, secrets, or identifiers and exists only to document a failure pattern.

Integrity is the set of unique tokens the extractor recognises in the original snapshot. After WolfMarkDown, every recognised token from that snapshot must still appear unchanged in the final document unless the user authorised removal.

Additional tokens are allowed. Repeated occurrences may decrease when duplicated prose is consolidated. Integrity does not count occurrences and does not protect every value a reader might consider important.

The verifier compares the snapshot with `verify-markdown.mjs --integrity-from <snapshot>`.

## Recognised protected-token classes

The extractor matches these classes only:

- URLs, exact
- Inline-code values and fenced code bodies, allowing harmless fence-marker formatting
- Solana-style base58 public keys, typically 32-44 characters
- Longer base58 transaction signatures, including ~88-character values
- Hex hashes of 40 or more characters
- Three-part semantic versions, including `1.2.3`, `v1.2.3`, `1.2.3-beta.1`, and `v1.2.3+build.7`
- Path-like strings starting `./`, `../`, `~/`, a POSIX absolute path with at least one directory, or a Windows drive-letter path such as `C:\Users\mark\notes.md`
- Environment names and assignments that match the extractor: `API_KEY`, `$API_KEY`, `${API_KEY}`, `API_KEY=`, and `` `API_KEY` ``
- ISO dates such as `2026-08-15` and numeric dates such as `15/08/2026`
- Percentages such as `12%`
- Currency amounts such as `$4.00`, `£4.00`, and `€4.00`
- Matched camelCase and snake_case identifier shapes such as `getTransaction` and `session_signer`

## Do not protect

These are outside the current extractor even when they look technical:

- Two-part versions such as `18.17`, `9.22`, or `11.0`
- Month-name dates such as `May 2027`
- Isolated integers such as `30000`
- Headings such as `CURRENT VERDICT`
- Ordinary slash-containing prose
- Short hex fragments

## Citations

Preserve Markdown links, URLs, source lists, valid footnote-like references, and factual attribution.

Do not invent citation URLs or source titles.

If the source uses agent-only citation markers that do not work in standalone Markdown, convert them only when the underlying URL or source text is available. Otherwise keep useful attribution conservatively and mention the portability limit in the completion report.

Do not change a technical value because it looks unusual. Do not normalise identifier case.
