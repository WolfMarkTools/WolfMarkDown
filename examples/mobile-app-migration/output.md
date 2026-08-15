# Mobile App Migration Review

## Executive Summary

The team has completed the first review of migrating the customer mobile application from the legacy framework.

The recommendation is to proceed with a phased migration rather than a complete rewrite.

Key reasons:

- Lower delivery risk
- Existing team skills can be reused
- Customers are not forced into a major update
- Rollback remains possible

## Current Architecture Review

The current application uses several older components.

| Component | Current Version | Replacement | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| React Native | 0.68.2 | 0.75.0 | Medium | Requires dependency updates |
| Node.js | 18.17 | 22 LTS | Low | Backend compatible |
| Firebase SDK | 9.22 | 11.0 | Medium | Push notifications need testing |
| CI Pipeline | Jenkins | GitHub Actions | High | Requires migration planning |

## Migration Phases

### Phase 1 - Preparation

Tasks:

- Audit dependencies
- Create migration branch
- Update development environments

### Phase 2 - Framework Upgrade

Tasks:

- Upgrade React Native version
- Test native modules
- Validate Android and iOS builds

### Phase 3 - Release

Tasks:

- Internal testing
- Beta rollout
- Full customer release

## Technical Decisions

### Decision: GitHub Actions migration

The team decided to migrate CI because Jenkins maintenance costs have increased.

Benefits:

- Lower maintenance overhead
- Better integration with repository workflows
- Easier developer access

Risks:

- Existing pipeline scripts may need rewriting
- Secrets migration required

## Configuration Example

The following environment variables are required:

```env
APP_ENV=production
API_TIMEOUT=30000
BUILD_VERSION=1.4.0
```

Do not change these values unless approved by engineering.

## Timeline and Costs

| Area               | Estimate | Owner       | Status      |
| ------------------ | -------- | ----------- | ----------- |
| Dependency Updates | 2 weeks  | Engineering | Planned     |
| CI Migration       | 1 week   | DevOps      | In Progress |
| Testing            | 3 weeks  | QA          | Not Started |

## Important note

The following dates are estimates only:

- **Development complete:** March 2027
- **Testing complete:** April 2027
- **Release target:** May 2027

The dates may change.

## Potential Issues

The team discussed several concerns.

### Database migration

This section was unclear in the meeting notes and requires further investigation.

Do not assume this means the database will definitely be replaced.

## Final Recommendation

Proceed with phased migration.

The project should prioritise reducing customer impact while improving maintainability.
