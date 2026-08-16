# Eval: technical-content preservation

Use `tests/fixtures/input/technical-content.md` as the input.

## Required

- Every unique recognised protected token survives.
- Do not silently change numbers, addresses, versions, or dates even when they are outside the extractor.
- Integrity PASS proves recognised token classes only.
- `CURRENT VERDICT` may become a heading, but its words are not env vars to invent or delete as identifiers.
- Final document passes `verify-markdown.mjs --integrity-from` the original snapshot.

## Prohibited

- Case changes in identifiers.
- "Fixing" unusual values.
