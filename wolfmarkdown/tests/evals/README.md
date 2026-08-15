# WolfMarkDown semantic evals

These cases exercise the agent-owned half of WolfMarkDown. They are not byte-for-byte Node formatter tests.

## How to run

1. Copy the eval `input` block to a working temporary file.
2. Follow `SKILL.md` against that file, including the original snapshot, format, and `verify-markdown.mjs --integrity-from` the snapshot.
3. Score the result against Required and Prohibited.
4. Delete the working file and the snapshot afterwards.

The deterministic verifier must exit 0 on the agent's final document except for `failure-recovery` and `negative-discovery`.

`negative-discovery` must not create a file. `failure-recovery` must end FAIL with the original preserved.

Baseline executed 2026-08-15 against the current SKILL.md workflow:

- compose-export: PASS
- compose-explicit-path: PASS
- compose-inferred-path: PASS
- portable-citations: PASS
- minimal-semantic-change: PASS
- existing-target-collision: PASS
- failure-recovery: PASS
- negative-discovery: PASS
- semantic-structure-recovery: synthetic structural regression for table, heading, labelled-list, sibling-section, paragraph, and technical-token recovery; no live research or network identifiers
- policy-specification-recovery: policy matrix, normative sequence, labelled evidence, sibling verdicts, and protected identifiers
- meeting-notes-recovery: decision hierarchy, action register, discussion paragraphs, ordered questions, dates, and technical tokens
- mixed-operations-report-recovery: multiple matrices, sibling findings and experiments, nested execution steps, recommendations, percentages, and costs

These cases require source-grounded semantic evidence and unresolved-ambiguity reporting. Deterministic PASS remains necessary but is not the semantic oracle.

Semantic PASS establishes Markdown-quality evidence only. It does not fact-check source claims, establish completeness or currency, or authorise publication.

## Cases pending fresh-agent execution

- ambiguous-structure-preservation: headerless tab runs, isolated warning sentences, and lone labels that must remain conservatively preserved

## Two-pass workflow forward test

Fresh-agent runs on 2026-08-15 used only the redesigned skill and raw synthetic fixture, without the eval rubric:

- policy specification: PASS; one policy table, two sibling verdicts, labelled facts, and four ordered steps recovered;
- meeting notes: PASS; one action table, two sibling decisions, labelled facts, discussion paragraphs, and three ordered questions recovered;
- mixed operations report: PASS; two tables, sibling findings and experiments, six nested execution steps, and three ordered recommendations recovered.

Each output also passed the deterministic verifier, protected-token integrity against its untouched fixture, and idempotence. Forward-test outputs remained in OS temporary storage and are not repository fixtures.

The v0.2.1 Node suite exercises the evaluator with both a successful structural recovery and a failing invented-table candidate. A full agent run still requires a host-produced candidate and should report the host, model, source scope, and unresolved ambiguities alongside deterministic verification.
