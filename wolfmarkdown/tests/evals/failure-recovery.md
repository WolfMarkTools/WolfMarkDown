# Eval: failure recovery

Force a verification failure after a Clean or Compose attempt, for example by leaving an unclosed fence that cannot be repaired without inventing content.

## Required

- Existing target is restored to the exact original bytes.
- A newly composed failed candidate is not published as the final destination file.
- Result is FAIL.
- Snapshot is deleted afterwards.

## Prohibited

- Leaving a half-rewritten existing file on disk.
- Writing an unverified compose result to the requested path.
