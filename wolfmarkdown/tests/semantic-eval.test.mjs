import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSemanticProperties } from "../lib/semantic-eval.mjs";

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
});

test("semantic evaluator rejects invented structure for ambiguous input", () => {
  const source = "alpha-east\t12\nDo not start new deployment while previous job still finalising.\nStatus: pending recorded RUN_42.";
  const candidate = "| Region | Count |\n| --- | --- |\n| alpha-east | 12 |\n\nDo not start new deployment while previous job still finalising.\n\nStatus: pending recorded RUN_42.\n";
  const result = evaluateSemanticProperties(source, candidate, {
    maxTables: 0,
    preserve: ["alpha-east\t12", "Status: pending", "RUN_42"],
    forbidTableText: ["Region", "Count"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.checks.ambiguity, false);
  assert.match(result.errors.join("\n"), /Ambiguous text|at most 0 GFM tables|source text missing/u);
});
