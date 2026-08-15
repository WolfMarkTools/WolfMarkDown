# Eval: meeting notes recovery

## Input

Use `tests/fixtures/input/meeting-notes-recovery.md`.

## Required

- Recover the document title and the Meeting Details, Decisions, Action Register, Discussion, and Open Questions boundaries as headings.
- Keep Runtime Baseline and Rollout Order as distinct sibling decision sections.
- Normalise each `Status`, `Decision`, and `Reason` group as labelled list items.
- Reconstruct the three-row action register as a GFM table with dates and statuses unchanged.
- Preserve the three open questions as an ordered list.
- Keep the two Discussion concepts as separate paragraphs.
- Preserve `2026-08-15`, `migrate_schema_v3`, `getMigrationStatus`, and `MIGRATION_CHECKPOINT` exactly.
- Report source-grounded semantic evidence and any unresolved ambiguity before deterministic PASS.

## Prohibited

- Turning meeting notes into a fabricated transcript.
- Merging the two decisions or assigning an unanswered question.
- Changing owners, dates, or statuses.
