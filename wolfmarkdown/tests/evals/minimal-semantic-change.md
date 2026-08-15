# Eval: minimal semantic change

Input is `tests/fixtures/input/already-clean.md` (or an equivalent already-good technical document).

## Required

- Already-good technical prose remains materially unchanged.
- `Privy is selected for the prototype signing architecture.` is not rewritten for style.
- Deterministic format may only apply Prettier-stable whitespace if needed.
- Prefer a no-op when the file already conforms.

## Prohibited

- Turning "Privy supports delegated signing." into "Delegated signing functionality is supported by Privy."
