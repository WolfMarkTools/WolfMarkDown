# Eval: decorative versus substantive emoji

## Input

```markdown
# Status

Tests passed ✅

The affected characters are ✅, ❌ and ⚠️.
```

## Required

- `Tests passed ✅` may become `Tests passed.`
- `The affected characters are ✅, ❌ and ⚠️.` keeps those characters.
- A formatter-only run on the same input must not delete either class of emoji.
- Agent result passes deterministic verification.

## Prohibited

- Deleting the characters that the second sentence is about.
- Claiming the formatter removed the decorative emoji.
