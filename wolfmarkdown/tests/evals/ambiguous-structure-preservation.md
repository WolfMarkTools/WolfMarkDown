# Eval: ambiguous structure preservation

## Input

Use `tests/fixtures/input/ambiguous-structure-preservation.md`.

## Required

- Preserve `alpha-east`, `bravo-west`, `charlie-north`, `12`, `9`, `6`, and `RUN_42` exactly and in source order.
- Treat the three tab-separated observations as an ambiguous headerless run. Preserve each record on a printer-stable Markdown boundary, such as a list item or its own paragraph. Do not leave adjacent raw rows that Prettier will collapse into one paragraph.
- Do not create a table schema. Do not invent headers such as `Region` and `Count`.
- Keep `Do not start a new deployment while the previous job is still finalising.` as a paragraph unless surrounding evidence establishes a section boundary.
- Keep the lone `Status: pending` phrase in prose; it is not a repeated labelled group.
- Report source-grounded semantic evidence and the unresolved header ambiguity before deterministic PASS.
- The formatted candidate must pass `evaluate-semantic.mjs --case ambiguous-structure-preservation` and `verify-markdown.mjs --integrity-from` the untouched source.

## Prohibited

- Creating a GFM table or inventing headers such as `Region` and `Count`.
- Collapsing the three observations onto one line.
- Promoting the warning sentence to a heading solely because it is short or imperative.
- Converting the lone `Status: pending` phrase into a Markdown list item.
- Requiring a literal tab character to survive Prettier.
- Claiming that the result validates the deployment advice or its factual correctness.
