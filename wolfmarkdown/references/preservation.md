# Technical preservation

Integrity is a set of unique protected tokens. After WolfMarkDown, every token extracted from the original snapshot must still appear unchanged in the final document unless the user authorised removal.

Additional tokens are allowed. Repeated occurrences may decrease when duplicated prose is consolidated.

The verifier compares the snapshot with `verify-markdown.mjs --integrity-from <snapshot>`.

## Protected classes

- URLs, exact
- Technically meaningful inline-code values
- Fenced code bodies, allowing harmless fence-marker formatting
- Solana-style base58 public keys, typically 32-44 characters
- Longer base58 transaction signatures, including ~88-character values
- Hex hashes of 40 or more characters
- Semantic versions, including `1.2.3`, `v1.2.3`, `1.2.3-beta.1`, and `v1.2.3+build.7`
- Path-like strings starting `./`, `../`, `~/`, or an absolute path with at least one directory
- Environment variables in technical context: `API_KEY`, `$API_KEY`, `${API_KEY}`, `API_KEY=`, and `` `API_KEY` ``
- Dates such as `2026-08-15` and `15/08/2026`
- Percentages such as `12%`
- Currency amounts such as `$4.00`, `£4.00`, and `€4.00`

## Do not protect

- Headings such as `CURRENT VERDICT`
- Ordinary slash-containing prose
- Isolated integers
- Short hex fragments

## Citations

Preserve Markdown links, URLs, source lists, valid footnote-like references, and factual attribution.

Do not invent citation URLs or source titles.

If the source uses agent-only citation markers that do not work in standalone Markdown, convert them only when the underlying URL or source text is available. Otherwise keep useful attribution conservatively and mention the portability limit in the completion report.

Do not change a technical value because it looks unusual. Do not normalise identifier case.
