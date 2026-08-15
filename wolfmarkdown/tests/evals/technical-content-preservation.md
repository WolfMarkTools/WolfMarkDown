# Eval: technical-content preservation

Use `tests/fixtures/input/technical-content.md` as the input.

## Required

- Every unique protected technical token survives.
- No number, address, version, or date is silently changed.
- `CURRENT VERDICT` may become a heading, but its words are not env vars to invent or delete as identifiers.
- Final document passes `verify-markdown.mjs --integrity-from` the original snapshot.

## Prohibited

- Case changes in identifiers.
- "Fixing" unusual values.
