Quarterly Reliability Review
Executive Summary
The quarter met the availability target but exposed queue saturation during batch imports. The next quarter should prioritise bounded concurrency.
Service Comparison
Service	Availability	Recovery Model	Owner
Ingest API	99.95%	Automatic retry	Data Platform
Worker Pool	99.80%	Manual drain	Runtime
Notification Relay	99.99%	Regional failover	Messaging
Incident Findings
Finding A: Queue Saturation
⚬ Status: Confirmed.
⚬ Analysis: import_batch_v4 accepted work faster than workers could drain it.
⚬ Recommendation: Cap intake at MAX_ACTIVE_IMPORTS.
Finding B: Delayed Notifications
⚬ Status: Mitigated.
⚬ Analysis: relay_failover switched regions after the alert threshold.
⚬ Recommendation: Keep the threshold and add a rehearsal.
Validation Experiments
Experiment 1: Intake Boundary
⚬ Objective: Confirm one request beyond MAX_ACTIVE_IMPORTS is rejected.
⚬ Execution Steps:
1. Fill all permitted slots.
2. Submit one additional import.
3. Confirm getImportStatus returns capacity_exceeded.
Experiment 2: Regional Failover
⚬ Objective: Confirm notifications continue after primary isolation.
⚬ Execution Steps:
1. Isolate the primary relay.
2. Invoke relay_failover.
3. Confirm getRelayStatus reports secondary_active.
Operational Costs
Component	Baseline Cost	Incident Cost	Forecast
Ingest API	£1200	£80	£1250
Worker Pool	£2400	£600	£2750
Notification Relay	£900	£40	£920
Recommendations
1. Introduce bounded intake for import_batch_v4.
2. Rehearse relay_failover once per quarter.
3. Preserve getImportStatus and getRelayStatus evidence for each exercise.
