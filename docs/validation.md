# Validation and evidence

This page records the evidence boundaries for WolfMarkDown. Current checks describe the repository at the current head; historical intake evidence is labelled separately.

## Current automated validation

The repository's Node test suite is run with:

```bash
npm test
```

At the time of this documentation pass, the suite passes **279 tests**. It covers the current runtime and publication workflow, including:

- CLI flags, batch discovery, standard input, and output-path handling;
- Doctor runtime/discovery status and installer behaviour (`--skip-deps` and `--runtime-only` separation);
- formatting, idempotence, Markdown parsing, GFM tables, fences, frontmatter, and lint;
- recognised protected-token extraction and integrity comparison;
- structural preservation: contextual ordered-numbering checks (item identity and effective position per sequence, including overlapping rankings), record-run boundary preservation, and source-grounded declared invariants (`--preserve-structure`, `--invariants`);
- citation diagnostics (adjacent numeric citations, MD052 deduplication, ledger cross-reference warnings) and the opt-in citation safe fix;
- receipts, previews (run counts and line-reduction warnings), issue reporting, target collisions, symlink boundaries, atomic publication, rollback, and failed-output refusal;
- scaffold inventory and source-map/semantic handoff contracts;
- effective lint-configuration evidence against the pinned markdownlint package;
- semantic property checks, regression signals (including the mixed-emphasis MD049 fixture), skill activation gates, and package/skill contract checks; and
- JSON verification output, the public example workflow, and the ranking-and-ledger acceptance fixtures (faithful candidate passes; renumbered tiers and a collapsed ledger fail, with the intact second ranking not satisfying the invariant).

The test command runs the repository's `wolfmarkdown` Node test suite through the root `package.json` script. The individual tests live under [`wolfmarkdown/tests`](../wolfmarkdown/tests/).

## Agent Skill validation

The canonical Agent Skill package is checked with:

```bash
npx --yes skills-ref validate ./wolfmarkdown
```

The current CI workflow pins the validator at `skills-ref@0.1.5` and validates `./wolfmarkdown` after installing the pinned runtime dependencies.

## CI coverage

The [GitHub Actions CI workflow](../.github/workflows/ci.yml) runs on pushes to `main` and pull requests. Its Node matrix is **22 and 24**. Each matrix job runs:

1. `npm ci --prefix wolfmarkdown`;
2. `npm test`;
3. `npx --yes skills-ref@0.1.5 validate ./wolfmarkdown`;
4. the public example's integrity-backed verification;
5. `node wolfmarkdown/scripts/doctor.mjs` as a runtime-health gate (exit 0 when the runtime is healthy, independent of discovery links); and
6. a `scaffold-markdown.mjs --json` smoke run over the public example input.

CI coverage is evidence that these checks ran in those environments. It is not evidence that every agent host accepts the skill or that every model makes the same semantic decisions.

## Dependency advisories

`npm audit` currently reports one low-severity chain: KaTeX prototype pollution ([GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7)) via `micromark-extension-math` inside `markdownlint`. WolfMarkDown never renders math to HTML; `markdownlint` only lints Markdown text, so the rendering conditions required for exploitation do not apply to this tool's runtime use.

A patched KaTeX release exists, but the installed `micromark-extension-math@3.1.0` depends on `katex ^0.16.0`, which cannot resolve to the patched line — the blocker is a compatible upstream dependency change, not the KaTeX patch itself. The deliberate decision is to track the advisory and revisit it when the dependency chain changes, rather than force a breaking `markdownlint` downgrade or an untested override.

## Lint policy and transparency

The project lint configuration disables MD029. MD029's styles do not support arbitrary continuation starts, which pressures agents to renumber legitimate continuation numbering (for example a Tier 2 list starting at 6 that continues Tier 1). Meaningful numbering is guarded by the structural preservation checks instead, and verification receipts record the effective lint configuration — including disabled rules and the bundled rule inventory — so the active ruleset is auditable.

## Semantic and property validation

The repository includes executable semantic-property checks under [`wolfmarkdown/tests/evals`](../wolfmarkdown/tests/evals) and [`wolfmarkdown/tests/semantic-eval.test.mjs`](../wolfmarkdown/tests/semantic-eval.test.mjs). They cover conservative preservation of ambiguous record-like content and reject an invented table for the same ambiguous source.

The evaluator can also be run for a named case:

```bash
node wolfmarkdown/scripts/evaluate-semantic.mjs \
  --case ambiguous-structure-preservation \
  source.md candidate.md
```

These checks validate structural properties of a supplied candidate. A full host-agent run remains separate evidence and should report the host, model, source scope, and unresolved ambiguities.

## Public example

The public [Mobile App Migration example](../examples/mobile-app-migration/README.md) is verified against its untouched input with:

```bash
node wolfmarkdown/scripts/verify-markdown.mjs \
  examples/mobile-app-migration/output.md \
  --integrity-from examples/mobile-app-migration/input.md
```

This checks the published fixture's Markdown properties and recognised-token preservation. It does not establish the factual correctness of the example's content.

## Historical external-plugin intake

Repository history records an automated GitHub Awesome Copilot external-plugin intake for the immutable `v0.2.1` submission at commit [`2323dd0f806f803dafd42e28a743d8ca7b6fd410`](https://github.com/WolfMarkTools/WolfMarkDown/tree/2323dd0f806f803dafd42e28a743d8ca7b6fd410), referenced by [awesome-copilot#2676](https://github.com/github/awesome-copilot/issues/2676). The historical evidence covered Agent Plugins specification compliance, Vally validation, a skill smoke test, and immutable version/ref/SHA consistency.

The earlier `v0.1.1` package at commit [`1a9cc10e00a39c6c82b1985a565e0d840f80f533`](https://github.com/WolfMarkTools/WolfMarkDown/tree/1a9cc10e00a39c6c82b1985a565e0d840f80f533) is also recorded in repository history as historical Agent Plugins packaging/intake evidence.

Neither intake record proves that GitHub accepted WolfMarkDown into a directory, that a host accepted it for general use, or that a human maintainer approved it. Automated packaging and intake validation are distinct from host acceptance and human approval.

## Evidence boundary

Tests, CI, skill validation, packaging checks, semantic property checks, public-fixture verification, and host smoke tests establish only the properties they actually exercise. Structural preservation checks prove the specific sequence and record-boundary properties they implement; they are not a proof of full semantic equivalence. None of these checks establishes:

- factual correctness;
- completeness or currency;
- policy compliance;
- authorisation to publish; or
- identical semantic quality across models or agent hosts.
