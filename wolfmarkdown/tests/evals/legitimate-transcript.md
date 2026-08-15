# Eval: legitimate transcript

## Input

```markdown
# Support interview

This file documents a real support exchange.

Interviewer: Which character set should the overlay reject?

Support: The affected characters are ✅, ❌ and ⚠️.

Interviewer: Thank you.
```

## Required

- Preserve intentional speaker labels.
- Preserve the dialogue.
- Do not treat the transcript as accidental conversation scaffolding.
- Preserve the substantive emoji because they are the subject of the answer.
- Final document passes deterministic verification.

## Prohibited

- Removing `Interviewer:` or `Support:`.
- Deleting the emoji characters in the Support line.
