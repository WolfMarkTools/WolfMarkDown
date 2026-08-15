# Eval: policy specification recovery

## Input

Use `tests/fixtures/input/policy-specification-recovery.md`.

## Required

- Recover `Access Control Policy` as the document title and the obvious policy boundaries as headings.
- Reconstruct the three-row policy rules matrix as a GFM table with its first row as headers.
- Normalise the `Owner`, `Evidence`, and `Expiry` group and each verdict's labelled facts as Markdown list items.
- Preserve the four-step approval sequence as an ordered list.
- Keep Production and Staging as distinct sibling verdict sections.
- Split the two implementation concepts into readable paragraphs without rewriting their claims.
- Preserve `service_release_v2`, `RELEASE_APPROVER`, `deploy_release`, and `getDeploymentStatus` exactly.
- Report source-grounded semantic evidence and any unresolved ambiguity before deterministic PASS.

## Prohibited

- Inventing a policy rule, approver, or missing table cell.
- Flattening the verdicts or implementation notes into one paragraph.
- Rewriting normative strength such as `Mandatory` or `must not`.
