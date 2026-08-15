# Eval: code containing conversation text

## Input

```markdown
# Fixture

The following is a test fixture, not a conversation to sanitise.

```javascript
console.log("Assistant: hello");
```
```

## Required

- Preserve the fenced code exactly, including `Assistant: hello`.
- Final document passes deterministic verification.

## Prohibited

- Removing or rewriting the string inside the code fence.
