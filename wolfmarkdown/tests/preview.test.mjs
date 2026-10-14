import assert from "node:assert/strict";
import test from "node:test";
import { previewDocuments } from "../lib/preview.mjs";
import { toReceipt } from "../lib/report.mjs";
import { readFixture } from "./helpers.mjs";

const collapsedLedger = [
  "# Synthetic ledger fixture",
  "",
  "## Sources",
  "",
  "[1] https://example.com/one [2] https://example.com/two [3] https://example.com/three [4] https://example.com/four",
  "",
].join("\n");

test("preview reports record and ordinal run counts on both sides", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const preview = await previewDocuments(source, collapsedLedger);
  assert.equal(preview.runs.source.records, 4);
  assert.equal(preview.runs.candidate.records, 0);
  assert.ok(preview.lineReduction.reducedBy > 0);

  const rankings = await readFixture("synthetic-two-rankings.md");
  const unchanged = await previewDocuments(rankings, rankings);
  assert.equal(unchanged.runs.source.ordinals, 3);
  assert.equal(unchanged.runs.candidate.ordinals, 3);
});

test("large non-blank line reductions warn without failing; modest edits do not", async () => {
  const long = [
    "# Title",
    "",
    ...Array.from({ length: 30 }, (_, index) => `Line ${index + 1} of the source document.`),
    "",
  ].join("\n");
  const short = "# Title\n\nLine 1 of the source document.\n";

  const reduced = await previewDocuments(long, short);
  assert.equal(reduced.lineReduction.warn, true);

  const subtle = await previewDocuments(long, long.replace("Line 30", "Line thirty"));
  assert.equal(subtle.lineReduction.warn, false);

  const receipt = toReceipt({ ok: true, checks: {} }, {
    preview: reduced,
    candidatePath: "candidate.md",
    candidateText: short,
  });
  assert.ok(receipt.warnings.some((warning) => warning.code === "large-line-reduction"));

  const quietReceipt = toReceipt({ ok: true, checks: {} }, {
    preview: subtle,
    candidatePath: "candidate.md",
    candidateText: long,
  });
  assert.ok(!quietReceipt.warnings.some((warning) => warning.code === "large-line-reduction"));
});
