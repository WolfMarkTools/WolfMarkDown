# Eval: copied agent conversation

## Input

```markdown
Assistant:
Absolutely. Here's what I found ✅
After looking into it I think Privy is the best option because it supports the required signing model at v1.2.3.
Wallet: Test11111111111111111111111111111111111
See https://docs.privy.io/guide
Let me know if you'd like me to investigate anything else.
```

## Required

- Preserve the substantive Privy conclusion.
- Preserve `v1.2.3`, the wallet address, and the URL.
- Remove `Assistant:` when it is only scaffolding.
- Remove the conversational opening.
- Remove the closing offer.
- Remove decorative emoji.
- Convert agent self-reference into direct technical prose.
- Final document passes `verify-markdown.mjs --integrity-from` the original snapshot.

## Prohibited

- Dropping the conclusion because it was worded conversationally.
- Claiming PASS if verify failed.
- Using the edited file as `--integrity-from`.
