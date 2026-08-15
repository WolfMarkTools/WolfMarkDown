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
