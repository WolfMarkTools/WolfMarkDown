import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { formatMarkdown } from "../lib/format.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { skillRoot } from "./helpers.mjs";

const inputPath = join(skillRoot, "tests", "fixtures", "input", "semantic-structure-recovery.md");
const evidencePath = join(skillRoot, "tests", "fixtures", "evidence", "semantic-structure-recovery.bad-output.md");
const evalPath = join(skillRoot, "tests", "evals", "semantic-structure-recovery.md");
const semanticRepairPath = join(skillRoot, "references", "semantic-repair.md");

const generalSemanticCases = [
  {
    name: "policy specification",
    fixture: "policy-specification-recovery.md",
    eval: "policy-specification-recovery.md",
    signals: [/Policy Rules/u, /\t/u, /⚬ Owner:/u, /Verdict on Production/u],
    assertions: [
      /GFM table/u,
      /Markdown list items/u,
      /ordered list/u,
      /sibling verdict sections/u,
      /semantic evidence/u,
    ],
  },
  {
    name: "meeting notes",
    fixture: "meeting-notes-recovery.md",
    eval: "meeting-notes-recovery.md",
    signals: [/Action Register/u, /\t/u, /⚬ Decision:/u, /Decision 2:/u],
    assertions: [
      /GFM table/u,
      /labelled list items/u,
      /ordered list/u,
      /sibling decision sections/u,
      /semantic evidence/u,
    ],
  },
  {
    name: "mixed operations report",
    fixture: "mixed-operations-report-recovery.md",
    eval: "mixed-operations-report-recovery.md",
    signals: [
      /Service Comparison/u,
      /\t/u,
      /⚬ Execution Steps:/u,
      /Experiment 2:/u,
    ],
    assertions: [
      /both the Service Comparison and Operational Costs matrices/u,
      /sibling finding sections/u,
      /sibling experiment sections/u,
      /ordered execution steps/u,
      /semantic evidence/u,
    ],
  },
];

test("synthetic report regression keeps semantic assertions separate from deterministic proof", async () => {
  const source = await readFile(inputPath, "utf8");
  const evidence = await readFile(evidencePath, "utf8");
  const semanticEval = await readFile(evalPath, "utf8");
  const formatted = await formatMarkdown(evidence);
  const deterministicResult = await verifyMarkdown(formatted);

  assert.equal(deterministicResult.ok, true, deterministicResult.errors.join("\n"));
  assert.match(evidence, /⚬ Status:/u);
  assert.match(evidence, /Comprehensive Provider and Primitive Feature Comparison Matrix/u);
  for (const assertion of [
    /at least five valid GFM tables/u,
    /standalone section boundaries as headings/u,
    /repeated `⚬ Label: value` structures/u,
    /distinct sibling sections/u,
    /readable paragraphs/u,
    /synthetic technical values and identifiers/u,
  ]) {
    assert.match(semanticEval, assertion);
  }

  for (const sibling of [
    "Architecture B3",
    "Architecture B4",
    "Atomic B4",
    "Policy Vault",
    "Provider A",
    "Provider B",
    "Other Infrastructure",
  ]) {
    assert.match(
      source,
      new RegExp(sibling, "u"),
      `semantic rubric sibling is missing from the synthetic source: ${sibling}`,
    );
    assert.match(
      semanticEval,
      new RegExp(sibling, "u"),
      `synthetic source sibling is missing from the semantic rubric: ${sibling}`,
    );
  }
});

test("semantic repair workflow requires source mapping and reconciliation", async () => {
  const guidance = await readFile(semanticRepairPath, "utf8");

  for (const assertion of [
    /Pass 1: build a source map/u,
    /Preserve/u,
    /Restructure/u,
    /Sanitise/u,
    /Compose/u,
    /Unresolved/u,
    /Confidence rule/u,
    /Clear signal/u,
    /Ambiguous signal/u,
    /Reconcile before formatting/u,
    /all clear source signals are accounted for/u,
    /Report semantic evidence/u,
  ]) {
    assert.match(guidance, assertion);
  }
});

for (const semanticCase of generalSemanticCases) {
  test(`${semanticCase.name} eval preserves transferable structural signals`, async () => {
    const fixture = await readFile(
      join(skillRoot, "tests", "fixtures", "input", semanticCase.fixture),
      "utf8",
    );
    const semanticEval = await readFile(
      join(skillRoot, "tests", "evals", semanticCase.eval),
      "utf8",
    );

    for (const signal of semanticCase.signals) {
      assert.match(fixture, signal);
    }

    for (const assertion of semanticCase.assertions) {
      assert.match(semanticEval, assertion);
    }
  });
}
