# Eval: mixed operations report recovery

## Input

Use `tests/fixtures/input/mixed-operations-report-recovery.md`.

## Required

- Recover the report title and obvious report boundaries as a logical heading hierarchy.
- Reconstruct both the Service Comparison and Operational Costs matrices as GFM tables with every source row and cell.
- Keep Queue Saturation and Delayed Notifications as sibling finding sections.
- Keep Intake Boundary and Regional Failover as sibling experiment sections.
- Normalise labelled finding and experiment facts; nest each experiment's ordered execution steps under its label.
- Preserve the final three recommendations as an ordered list.
- Preserve `99.95%`, `MAX_ACTIVE_IMPORTS`, `import_batch_v4`, `relay_failover`, `getImportStatus`, `capacity_exceeded`, `getRelayStatus`, `secondary_active`, and all currency values exactly.
- Report source-grounded semantic evidence and any unresolved ambiguity before deterministic PASS.

## Prohibited

- Merging findings, experiments, or tables into prose.
- Inventing operational costs or experiment outcomes.
- Treating formatting and token integrity alone as semantic PASS.
