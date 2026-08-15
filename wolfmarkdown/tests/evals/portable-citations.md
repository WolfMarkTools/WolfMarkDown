# Eval: portable citations

Source:

```markdown
Privy is documented at https://docs.privy.io/guide.

See also [embedded wallets](https://docs.privy.io/guide/react/wallets).

Agent marker: [1] (no URL supplied by the platform)
```

## Required

- `https://docs.privy.io/guide` survives.
- The Markdown link destination survives unchanged.
- The unnamed agent marker is not converted into a fabricated URL.
- Verify PASS.

## Prohibited

- Inventing `https://example.com/1` or similar for `[1]`.
- Dropping the real URLs.
