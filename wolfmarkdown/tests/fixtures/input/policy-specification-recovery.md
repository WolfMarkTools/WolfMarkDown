Access Control Policy
Purpose
This policy defines how deployment approvals are requested and recorded. It applies to service_release_v2 and the RELEASE_APPROVER role.
Policy Rules
Rule ID	Scope	Requirement	Failure Action
POL-01	Production	Two approvers	Block release
POL-02	Staging	One approver	Record warning
POL-03	Emergency	Incident commander	Start retrospective
Exception Review
⚬ Owner: Platform Governance
⚬ Evidence: Approved ticket and deployment record.
⚬ Expiry: Every exception expires after 24 hours.
Approval Sequence
1. Create the change record.
2. Obtain the required approval.
3. Run deploy_release --record RELEASE_APPROVER.
4. Attach getDeploymentStatus output.
Enforcement Verdicts
Verdict on Production
⚬ Status: Mandatory.
⚬ Rationale: Production changes affect customer traffic.
⚬ Recommendation: Reject incomplete approval chains.
Verdict on Staging
⚬ Status: Required with warning-only fallback.
⚬ Rationale: Staging remains a shared validation environment.
⚬ Recommendation: Preserve an auditable record.
Implementation Notes
The validator checks service_release_v2 before dispatch. A missing role blocks production execution.
The reporting layer records the decision after execution. It must not turn a failed deployment into an approved result.
