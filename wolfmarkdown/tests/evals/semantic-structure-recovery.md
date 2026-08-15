# Eval: synthetic wallet payment architecture report

## Regression input

Use the synthetic source fixture at `tests/fixtures/input/semantic-structure-recovery.md`. It contains the same structural failure signals as the original report without reproducing live research or live network identifiers. The failed result captured at `tests/fixtures/evidence/semantic-structure-recovery.bad-output.md` is evidence of the failure pattern only; it is not an expected output and must not be copied.

## Required agent-owned semantic assertions

The repaired candidate must preserve the source wording and technical values while satisfying these structural assertions:

- Reconstruct at least five valid GFM tables from the clear matrices. The tables must cover the architectural core, comprehensive provider/primitive comparison, security comparison, UX comparison, and financial/rent comparison. Use each matrix's first row as headers and preserve stable rows/cells; do not invent missing values.
- Recover standalone section boundaries as headings, including headings equivalent to `Program Architecture and Operational Mechanics`, `Execution Workflow Architecture`, `Primary Provider and Primitive Deep-Dive Verdicts`, `Verdict on Architecture B4`, `Verdict on Atomic B4`, `Verdict on Policy Vault`, `Experiment 3: Boundary Limit Enforcement`, and `Operational Protocol Inquiries for the Payment Provider`.
- Convert repeated `⚬ Label: value` structures into Markdown list items, preferably `- **Label:** value`. This includes `Status`, `Analysis`, `Recommendation`, `Protocol Failures`, `Detailed Technical Findings`, `Objective`, and `Execution Steps`; retain numbered steps where order is material and nest them under the relevant label.
- Keep Architecture B3, Architecture B4, Atomic B4, Squads v4, Coinbase CDP, Privy, and Turnkey/Kora/Jito as distinct sibling sections. Do not merge a verdict heading or its labelled facts into the preceding paragraph.
- Split long source blocks at conceptual transitions into readable paragraphs. Do not use the absence of source blank lines as a reason to emit one giant paragraph.
- Preserve these exact synthetic technical values and identifiers: `test_program_id_001`, `test_mint_address_001`, `test_destination_ata_001`, `test_token_program_001`, `subscriptions::transfer_recurring`, `spl_token::transfer_checked`, `spl_token::approveChecked`, `SubscriptionAuthority`, `RecurringDelegation`, `u64::MAX`, `submit_signed_*`, `getTransaction`, and `getSignatureStatuses`. These values are deliberately non-live placeholders. Inline-code formatting is acceptable only if the text is unchanged.
- Run the normal snapshot, Prettier, deterministic verifier, protected-token integrity, and idempotence workflow. The candidate must be valid and idempotent Markdown, but those checks do not replace the assertions above.

## Prohibited

- Do not hard-code Solana or AlphaMission wording into WolfMarkDown's implementation or guidance beyond using this report as a representative regression.
- Do not accept the failed flattened output merely because it parses, formats, preserves most text, or passes token integrity.
- Do not use a full-document snapshot as the semantic oracle. Judge structure with the assertions above and allow equivalent heading levels or concise wording where the source boundary is unambiguous.
