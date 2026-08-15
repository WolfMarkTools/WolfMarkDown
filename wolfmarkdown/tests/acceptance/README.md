# Cross-agent acceptance pack

Run these three inputs through the same canonical WolfMarkDown skill. Compare invariants, not byte-for-byte prose.

Principal behavioural harnesses: Grok Build, Codex, Cursor, Claude Code.

Compatibility smoke-test harnesses: OpenCode, Gemini CLI, Antigravity, GitHub Copilot.

Do not require all eight locally. Use the same inputs when a harness is available.

## How to run

1. Open this WolfMarkDown repository so `.agents/skills/wolfmarkdown` is discoverable, or install with `node wolfmarkdown/scripts/install.mjs`.
2. Give the agent the input and the user request.
3. Require a real `.md` file when the request is compose or clean.
4. Run `node wolfmarkdown/scripts/verify-markdown.mjs <output> --integrity-from <source-snapshot>`.
5. Score the invariants below.

## 1. Ugly AI research

File: `ugly-research.md`

Request: Export this as a Markdown file.

Invariants:

- Conversational opening and closing offer are gone.
- Privy conclusion remains.
- No decorative status emoji in the finished document unless they are the subject.
- Verify PASS.

## 2. Technical research

File: `technical-research.md`

Request: Save this as Markdown.

Invariants:

- Pubkey, signature-shaped value, URL, versions, and comparison facts survive unchanged.
- A table is acceptable when the comparison is structured; invented cells are not.
- Verify PASS with `--integrity-from` the source.

## 3. Already-good document

File: `already-good.md`

Request: WolfMarkDown this file.

Invariants:

- Minimal or no semantic rewrite.
- Technical sentences keep their original wording.
- Verify PASS.
