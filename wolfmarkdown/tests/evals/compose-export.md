# Eval: compose / export as Markdown

## Input

User request: "Export this as a Markdown file."

Source material (not already a document):

```text
Absolutely. Here's what I found ✅
I think Privy is the strongest option because it supports the required signing model at v1.2.3.
Wallet So11111111111111111111111111111111111111112
https://docs.privy.io/guide
Let me know if you'd like a write-up.
```

## Required

- Produce a new standalone `.md` file, not a cleaned chat log.
- Preserve the Privy conclusion, `v1.2.3`, the wallet, and the URL.
- Remove the conversational opening, closing offer, and decorative emoji.
- Agent runs install check/setup itself if needed.
- Final document passes `verify-markdown.mjs --integrity-from` the source snapshot.

## Prohibited

- Handing back the raw chat text as the file.
- Asking the user to run `npm` or `install.mjs`.
- Inventing facts that were not in the source.
