import assert from "node:assert/strict";
import test from "node:test";
import { formatMarkdown } from "../lib/format.mjs";
import { documentScaffold } from "../lib/scaffold.mjs";
import { checkRecordPreservation, detectRecordRuns } from "../lib/preservation.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { readFixture } from "./helpers.mjs";

const ledgerLines = [
  "[1] https://example.com/one",
  "[2] https://example.com/two",
  "[3] https://example.com/three",
  "[4] https://example.com/four",
];

test("ledger detection excludes multiline code and container code while retaining live line numbers", () => {
  for (const protectedText of [
    "Open `code\n[1] alpha\n[2] beta\n[3] gamma\nend`",
    "- ```text\n  [1] alpha\n  [2] beta\n  [3] gamma\n  ```",
    "- paragraph\n\n\t[1] alpha\n\t[2] beta\n\t[3] gamma",
  ]) {
    assert.deepEqual(detectRecordRuns(protectedText), [], protectedText);
    const input = `# Doc\n\n${protectedText}\n\n${ledgerLines.join("\n")}\n`;
    const runs = detectRecordRuns(input);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].count, 4);
    assert.equal(runs[0].startLine, input.split("\n").indexOf(ledgerLines[0]) + 1);
    assert.equal(checkRecordPreservation(protectedText, "# Doc\n").ok, true);
  }
});

test("records require the source label and value together at the start of their own line", () => {
  const source = "[1] alpha\n[2] beta\n[3] gamma\n";
  const swapped = "[2] alpha [1]\n[1] beta [2]\n[3] gamma\n";
  assert.equal(checkRecordPreservation(source, swapped).ok, false);
  assert.equal(checkRecordPreservation(source, source).ok, true);
});

function collapsedCandidate() {
  return [
    "# Synthetic ledger fixture",
    "",
    "## Findings",
    "",
    "Alpha Model leads the group [1] [3].",
    "",
    "## Sources",
    "",
    ledgerLines.join(" "),
    "",
  ].join("\n");
}

test("detectRecordRuns finds a four-record ledger with labels and anchors", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const runs = detectRecordRuns(source);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].count, 4);
  assert.deepEqual(
    runs[0].records.map((record) => record.label),
    ["1", "2", "3", "4"],
  );
  assert.equal(runs[0].records[0].anchor, "https://example.com/one");
  assert.equal(runs[0].startLine, 9);
});

test("detectRecordRuns ignores short runs, fences and indented code", () => {
  assert.equal(detectRecordRuns("[1] a\n[2] b\n").length, 0);
  const fenced = ["```text", "[1] a", "[2] b", "[3] c", "```", ""].join("\n");
  assert.equal(detectRecordRuns(fenced).length, 0);
  const indented = ["    [1] a", "    [2] b", "    [3] c", ""].join("\n");
  assert.equal(detectRecordRuns(indented).length, 0);
  const interrupted = ["[1] a", "[2] b", "", "text", "[3] c", "[4] d"].join("\n");
  assert.equal(detectRecordRuns(interrupted).length, 0);
});

test("records preserved as two-space hard breaks or list items pass", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const hardBreak = source.replace(/^(\[\d+\] .*)$/gmu, "$1  ");
  const hardBreakResult = checkRecordPreservation(source, hardBreak);
  assert.equal(hardBreakResult.ok, true, hardBreakResult.issues.map((issue) => issue.message).join("\n"));

  const listForm = source.replace(/^(\[\d+\] .*)$/gmu, "- $1");
  const listResult = checkRecordPreservation(source, listForm);
  assert.equal(listResult.ok, true, listResult.issues.map((issue) => issue.message).join("\n"));
});

test("a collapsed ledger fails even though every URL and label survives", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const collapsed = collapsedCandidate();
  for (const line of ledgerLines) assert.ok(collapsed.includes(line.split(" ")[1]), "URL present in candidate");
  for (const label of ["[1]", "[2]", "[3]", "[4]"]) assert.ok(collapsed.includes(label), "label present in candidate");

  const result = checkRecordPreservation(source, collapsed);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => /own line/u.test(issue.message)));
});

test("reordered records fail with an order message", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const reordered = source.replace(
    "[1] https://example.com/one\n[2] https://example.com/two",
    "[2] https://example.com/two\n[1] https://example.com/one",
  );
  const result = checkRecordPreservation(source, reordered);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => /order or association/u.test(issue.message)));
});

test("repeated labels cannot share one line", () => {
  const source = "# Ledger\n\n## Sources\n\n[7] alpha-one\n[7] bravo-two\n[7] charlie-three\n";
  const sharedLine = "# Ledger\n\n## Sources\n\n[7] alpha-one [7] bravo-two [7] charlie-three\n";
  const failing = checkRecordPreservation(source, sharedLine);
  assert.equal(failing.ok, false);
  const threeLines = "# Ledger\n\n## Sources\n\n[7] alpha-one\n[7] bravo-two\n[7] charlie-three\n";
  const passing = checkRecordPreservation(source, threeLines);
  assert.equal(passing.ok, true, passing.issues.map((issue) => issue.message).join("\n"));
});

test("records hidden inside a candidate fence do not satisfy the boundary check", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const fenced = [
    "# Synthetic ledger fixture",
    "",
    "## Sources",
    "",
    "```text",
    ...ledgerLines,
    "```",
    "",
  ].join("\n");
  const result = checkRecordPreservation(source, fenced);
  assert.equal(result.ok, false);
});

test("a format-only candidate collapses the ledger and fails boundary preservation", async () => {
  // The printer merges adjacent raw record lines into one paragraph; a
  // Clean must make records printer-surviving (hard breaks or list items)
  // before formatting. This reproduces the observed ledger collapse case.
  const source = await readFixture("synthetic-sources-ledger.md");
  const formatOnly = await formatMarkdown(source);
  assert.notEqual(formatOnly, source);
  assert.ok(formatOnly.split("\n").length < source.split("\n").length);
  const result = checkRecordPreservation(source, formatOnly);
  assert.equal(result.ok, false);
});

test("verifyMarkdown reports record collapse with --preserve-structure", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const collapsed = collapsedCandidate();
  const result = await verifyMarkdown(collapsed, { integrityFromText: source, preserveStructure: true });
  assert.equal(result.checks.records, false);
  assert.ok(result.issues.some((issue) => issue.check === "records"));
  assert.ok(
    result.issues.filter((issue) => issue.check === "records").every((issue) => issue.remediation.length > 0),
  );

  const faithful = await verifyMarkdown(source, { integrityFromText: source, preserveStructure: true });
  assert.equal(faithful.checks.records, true, faithful.errors.join("\n"));

  const withoutFlag = await verifyMarkdown(collapsed, { integrityFromText: source });
  assert.equal(withoutFlag.checks.records, null);
});

test("scaffold inventories record runs and ordinal runs", async () => {
  const ledger = documentScaffold(await readFixture("synthetic-sources-ledger.md"));
  assert.equal(ledger.recordRuns.length, 1);
  assert.equal(ledger.recordRuns[0].count, 4);
  const rankings = documentScaffold(await readFixture("synthetic-two-rankings.md"));
  assert.equal(rankings.ordinalRuns.length, 3);
  assert.equal(rankings.ordinalRuns[1].start, 3);
  assert.equal(rankings.ordinalRuns[1].section, "Tier 2 — provisional candidates");
});

test("records wrapped in inline code cannot satisfy record preservation", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const wrapped = [
    "# Synthetic ledger fixture",
    "",
    "## Sources",
    "",
    ...ledgerLines.map((line) => "``" + line + "``"),
    "",
  ].join("\n");
  const control = checkRecordPreservation(source, source);
  assert.equal(control.ok, true, control.issues.map((issue) => issue.message).join("\n"));
  const result = checkRecordPreservation(source, wrapped);
  assert.equal(result.ok, false);
});
