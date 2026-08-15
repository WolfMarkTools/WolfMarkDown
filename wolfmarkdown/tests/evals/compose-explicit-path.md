# Eval: compose with explicit path

User: Save this research as docs/verdict.md

Source:

```text
Here's what I found.
Privy is selected because it supports the required signing model at v1.2.3.
See https://docs.privy.io/guide
```

## Required

- Create the actual file at `docs/verdict.md` relative to the working tree used for the eval.
- Standalone document, no conversational opening.
- Preserve `v1.2.3` and the URL.
- Format PASS and verify PASS against the source snapshot.

## Prohibited

- Only printing Markdown in chat.
- Inventing extra facts.
