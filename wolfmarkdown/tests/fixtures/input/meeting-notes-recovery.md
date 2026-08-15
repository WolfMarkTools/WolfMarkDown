Migration Planning Notes
Meeting Details
Date: 2026-08-15
Facilitator: Rowan
Participants: Platform, Product, Support
Decisions
Decision 1: Runtime Baseline
⚬ Status: Accepted.
⚬ Decision: Support Node.js 20 and newer releases.
⚬ Reason: Consumers currently use Node.js 20, 22, and 24.
Decision 2: Rollout Order
⚬ Status: Accepted.
⚬ Decision: Migrate staging before production.
⚬ Reason: Staging provides representative traffic without customer impact.
Action Register
Action	Owner	Due	Status
Publish compatibility note	Documentation	2026-08-18	Open
Run staging rehearsal	Platform	2026-08-19	Open
Review support macros	Support	2026-08-20	Blocked
Discussion
The staging rehearsal must capture migrate_schema_v3 output and getMigrationStatus. The runbook owner will compare those records before approving production.
Support needs a customer-facing explanation. Product will provide wording after the rehearsal confirms expected downtime.
Open Questions
1. Does the rollback preserve MIGRATION_CHECKPOINT?
2. Who owns the final production window?
3. Which status page message is required?
