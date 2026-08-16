import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { formatMarkdown } from "../lib/format.mjs";
import { evaluateSemanticProperties } from "../lib/semantic-eval.mjs";
import { loadJson } from "../lib/paths.mjs";
import { skillRoot } from "./helpers.mjs";

const fixtureRoot = join(skillRoot, "tests", "fixtures");
const ambiguousProperties = loadJson("tests/evals/semantic-properties.json")["ambiguous-structure-preservation"];

async function readCase(kind, name) {
  return readFile(join(fixtureRoot, kind, name), "utf8");
}

test("semantic evaluator checks headings, GFM tables, and protected tokens without snapshots", () => {
  const source = [
    "Decision Comparison Provider Mode Risk Privy External approval Medium CDP Embedded wallet High",
    "Use relay_v2 and confirm getTransaction.",
  ].join("\n");
  const candidate = [
    "# Decision",
    "",
    "## Comparison",
    "",
    "| Provider | Mode | Risk |",
    "| --- | --- | --- |",
    "| Privy | External approval | Medium |",
    "| CDP | Embedded wallet | High |",
    "",
    "Use `relay_v2` and confirm `getTransaction`.",
    "",
  ].join("\n");
  const result = evaluateSemanticProperties(source, candidate, {
    headings: ["Comparison"],
    minTables: 1,
    preserve: ["relay_v2", "getTransaction"],
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.evidence.tableCount, 1);
  assert.equal(result.checks.records, true);
});

test("conservative list candidate preserves ambiguous records after Prettier", async () => {
  const source = await readCase("input", "ambiguous-structure-preservation.md");
  const candidate = await formatMarkdown(await readCase("expected", "ambiguous-structure-conservative.md"));
  const result = evaluateSemanticProperties(source, candidate, ambiguousProperties);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checks.tables, true);
  assert.equal(result.checks.records, true);
  assert.equal(result.checks.ambiguity, true);
  assert.equal(result.evidence.tableCount, 0);
});

test("blank-line separated records also satisfy the ambiguous-structure case", async () => {
  const source = await readCase("input", "ambiguous-structure-preservation.md");
  const candidate = await formatMarkdown(
    [
      "# Migration observations",
      "",
      "alpha-east 12",
      "",
      "bravo-west 9",
      "",
      "charlie-north 6",
      "",
      "Do not start a new deployment while the previous job is still finalising.",
      "",
      "The checkpoint Status: pending is recorded against RUN_42 until the operator confirms the next window.",
      "",
    ].join("\n"),
  );
  const result = evaluateSemanticProperties(source, candidate, ambiguousProperties);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checks.records, true);
});

test("collapsed ambiguous rows fail because record boundaries did not survive", () => {
  const source = "alpha-east\t12\nbravo-west\t9\ncharlie-north\t6\n";
  const candidate = "alpha-east 12 bravo-west 9 charlie-north 6\n";
  const result = evaluateSemanticProperties(source, candidate, {
    preserveRecords: [
      ["alpha-east", "12"],
      ["bravo-west", "9"],
      ["charlie-north", "6"],
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.checks.records, false);
  assert.match(result.errors.join("\n"), /own line/u);
});

test("reordered or swapped associations fail the record check", () => {
  const source = "alpha-east\t12\nbravo-west\t9\n";
  const candidate = "- bravo-west 9\n- alpha-east 12\n";
  const result = evaluateSemanticProperties(source, candidate, {
    preserveRecords: [
      ["alpha-east", "12"],
      ["bravo-west", "9"],
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.checks.records, false);
  assert.match(result.errors.join("\n"), /order or association/u);
});

test("semantic evaluator rejects invented structure for ambiguous input", async () => {
  const source = await readCase("input", "ambiguous-structure-preservation.md");
  const candidate = await readCase("evidence", "ambiguous-structure-invented-table.md");
  const result = evaluateSemanticProperties(source, candidate, ambiguousProperties);
  assert.equal(result.ok, false);
  assert.equal(result.checks.tables, false);
  assert.equal(result.checks.ambiguity, false);
  assert.match(result.errors.join("\n"), /at most 0 GFM tables|promoted into a table/u);
});
