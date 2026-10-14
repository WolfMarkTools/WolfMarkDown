import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { formatMarkdown } from "../lib/format.mjs";
import {
  checkOrdinalPreservation,
  extractOrdinalRuns,
  itemAnchor,
  normaliseHeading,
} from "../lib/preservation.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { readFixture } from "./helpers.mjs";

const scriptPath = fileURLToPath(new URL("../scripts/verify-markdown.mjs", import.meta.url));

function corruptedTier2(source) {
  return source
    .replace("3. **Charlie Model**", "1. **Charlie Model**")
    .replace("4. **Delta Model**", "2. **Delta Model**");
}

test("extractOrdinalRuns records start values, item anchors and heading context", async () => {
  const source = await readFixture("synthetic-two-rankings.md");
  const runs = extractOrdinalRuns(source);
  assert.equal(runs.length, 3);
  assert.deepEqual(
    runs.map((run) => run.start),
    [1, 3, 1],
  );
  const tier2 = runs[1];
  assert.deepEqual(
    tier2.items.map((item) => item.anchor),
    ["Charlie Model", "Delta Model"],
  );
  assert.deepEqual(
    tier2.items.map((item) => item.position),
    [3, 4],
  );
  assert.equal(tier2.context[tier2.context.length - 1].text, "Tier 2 — provisional candidates");
  assert.equal(runs[2].context[runs[2].context.length - 1].text, "2. Cost ranking");
});

test("itemAnchor is insensitive to emphasis and whitespace, and cuts at an em dash", () => {
  assert.equal(itemAnchor("Charlie Model — vendor-only evidence"), "Charlie Model");
  assert.equal(itemAnchor("Alpha   Model"), "Alpha Model");
  assert.equal(itemAnchor("Alpha Model: "), "Alpha Model");
  assert.equal(normaliseHeading("2. Cost ranking"), "cost ranking");
  assert.equal(normaliseHeading("Tier 2 — provisional candidates"), "tier 2 — provisional candidates");
});

test("emphasis and marker changes that keep positions are not failures", async () => {
  const source = await readFixture("synthetic-two-rankings.md");
  const candidate = source.replace(/\*\*(Charlie|Delta) Model\*\*/gu, "$1 Model");
  const result = checkOrdinalPreservation(source, candidate);
  assert.equal(result.ok, true, result.issues.map((issue) => issue.message).join("\n"));
});

test("all-ones source notation and sequential numbering are equivalent", () => {
  const source = "# Steps\n\n1. Alpha\n1. Bravo\n1. Charlie\n";
  const sequential = "# Steps\n\n1. Alpha\n2. Bravo\n3. Charlie\n";
  const result = checkOrdinalPreservation(source, sequential);
  assert.equal(result.ok, true, result.issues.map((issue) => issue.message).join("\n"));
});

test("renumbered tier is a failure even though another ranking retains the same numbers", async () => {
  const source = await readFixture("synthetic-two-rankings.md");
  const corrupted = corruptedTier2(source);

  // The intact cost ranking still contains positions 3 and 4, so a check
  // based on sequence existence alone would falsely pass; the contextual
  // check must fail because the performance item moved.
  const costRuns = extractOrdinalRuns(corrupted).filter(
    (run) => run.context[run.context.length - 1]?.text === "2. Cost ranking",
  );
  assert.ok(costRuns[0].items.some((item) => item.position === 3 && item.anchor === "Alpha Model"));

  const result = checkOrdinalPreservation(source, corrupted);
  assert.equal(result.ok, false);
  const messages = result.issues.map((issue) => issue.message).join("\n");
  assert.match(messages, /Charlie Model/u);
  assert.match(messages, /position 1 but was at position 3/u);
  assert.match(messages, /Delta Model/u);
  assert.equal(result.runsChecked, 3);
});

test("verifyMarkdown reports the ordinal failure with --preserve-structure", async () => {
  const source = await readFixture("synthetic-two-rankings.md");
  const candidate = await formatMarkdown(corruptedTier2(source));
  const result = await verifyMarkdown(candidate, { integrityFromText: source, preserveStructure: true });
  assert.equal(result.checks.ordinals, false);
  assert.ok(result.issues.some((issue) => issue.check === "ordinals"));
});

test("verifyMarkdown passes the faithful candidate and skips without the flag", async () => {
  const source = await readFixture("synthetic-two-rankings.md");
  const faithful = await formatMarkdown(source);
  const withFlag = await verifyMarkdown(faithful, { integrityFromText: source, preserveStructure: true });
  assert.equal(withFlag.checks.ordinals, true, withFlag.errors.join("\n"));
  const withoutFlag = await verifyMarkdown(faithful, { integrityFromText: source });
  assert.equal(withoutFlag.checks.ordinals, null);
});

test("unconfirmed correspondence is reported as an ambiguity, not silent preservation", () => {
  const source = "# Title\n\n1. Aaa one\n2. Bbb two\n3. Ccc three\n4. Ddd four\n";
  const candidate = "# Title\n\n1. Aaa one\n2. Xxx two\n3. Yyy three\n4. Zzz four\n";
  const result = checkOrdinalPreservation(source, candidate);
  assert.equal(result.ok, true, result.issues.map((issue) => issue.message).join("\n"));
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].code, "ordinal-context-ambiguous");
});

test("single-item ordered lists and unordered lists carry no ordinal invariant", () => {
  assert.deepEqual(extractOrdinalRuns("# T\n\n1. only one\n"), []);
  assert.deepEqual(extractOrdinalRuns("# T\n\n- alpha\n- bravo\n"), []);
});

test("continuation-numbered lists are not pressured by markdownlint MD029", async () => {
  // MD029 (all styles) requires lists to start at 1; continuation numbering
  // such as a Tier 2 list starting at 6 is legitimate and must not fail
  // verification, because renumbering to satisfy it would change meaning.
  const markdown = "# Title\n\n## Tier 2\n\n6. Alpha Model — note [1].\n7. Bravo Model — note [2].\n";
  const candidate = await formatMarkdown(markdown);
  const result = await verifyMarkdown(candidate);
  assert.equal(result.checks.markdownlint, true, result.errors.join("\n"));
});

test("CLI: --preserve-structure fails a renumbered ranking and passes a faithful candidate", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-ordinals-"));
  const source = await readFixture("synthetic-two-rankings.md");
  const sourcePath = join(dir, "source.md");
  const candidatePath = join(dir, "candidate.md");
  await writeFile(sourcePath, source);

  await writeFile(candidatePath, await formatMarkdown(corruptedTier2(source)));
  let exitCode = 0;
  let stdout = "";
  try {
    stdout = execFileSync(
      process.execPath,
      [scriptPath, candidatePath, "--integrity-from", sourcePath, "--preserve-structure", "--json"],
      { encoding: "utf8" },
    );
  } catch (error) {
    exitCode = error.status;
    stdout = error.stdout;
  }
  assert.equal(exitCode, 1);
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.checks.ordinals, "fail");
  assert.ok(receipt.issues.some((issue) => issue.check === "ordinals"));

  await writeFile(candidatePath, await formatMarkdown(source));
  const passOutput = execFileSync(
    process.execPath,
    [scriptPath, candidatePath, "--integrity-from", sourcePath, "--preserve-structure", "--json"],
    { encoding: "utf8" },
  );
  const passReceipt = JSON.parse(passOutput);
  assert.equal(passReceipt.ok, true);
  assert.equal(passReceipt.checks.ordinals, "pass");
});

test("a lookalike list in another section cannot stand in for a vanished sequence", async () => {
  const source = [
    "# Report",
    "",
    "## Performance ranking",
    "",
    "1. Alpha Model — fast",
    "2. Bravo Model — steady",
    "3. Charlie Model — slow",
    "",
    "## Cost ranking",
    "",
    "1. Alpha Model — cheap",
    "2. Bravo Model — mid",
    "3. Charlie Model — dear",
    "",
  ].join("\n");
  const costOnly = [
    "# Report",
    "",
    "## Cost ranking",
    "",
    "1. Alpha Model — cheap",
    "2. Bravo Model — mid",
    "3. Charlie Model — dear",
    "",
  ].join("\n");
  const headingKept = [
    "# Report",
    "",
    "## Performance ranking",
    "",
    "## Cost ranking",
    "",
    "1. Alpha Model — cheap",
    "2. Bravo Model — mid",
    "3. Charlie Model — dear",
    "",
  ].join("\n");

  // Heading removed too: the change is ambiguous, so it is reported rather
  // than silently treated as preservation by the unrelated cost list.
  const ambiguous = checkOrdinalPreservation(source, costOnly);
  assert.equal(ambiguous.ok, true, ambiguous.issues.map((issue) => issue.message).join("\n"));
  assert.deepEqual(ambiguous.warnings.map((warning) => warning.code), ["ordinal-context-ambiguous"]);

  // Heading retained: the section remains but its sequence does not.
  const missing = checkOrdinalPreservation(source, headingKept);
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.some((issue) => /different ordered list/u.test(issue.message)));
  assert.equal(missing.warnings.length, 0);

  // A reduced list whose remainder no longer qualifies as a run is not
  // silently covered by the intact lookalike either.
  const reduced = [
    "# Report",
    "",
    "## Performance ranking",
    "",
    "1. Alpha Model — fast",
    "",
    "## Cost ranking",
    "",
    "1. Alpha Model — cheap",
    "2. Bravo Model — mid",
    "3. Charlie Model — dear",
    "",
  ].join("\n");
  assert.equal(checkOrdinalPreservation(source, reduced).ok, false);

  const verified = await verifyMarkdown(headingKept, { integrityFromText: source, preserveStructure: true });
  assert.equal(verified.checks.ordinals, false);
});

test("heading promotion is not a false failure; a heading rename is reported as ambiguity", () => {
  const promoted = checkOrdinalPreservation(
    "# Title\n\n### Tier 2\n\n1. Aaa one\n2. Bbb two\n",
    "# Title\n\n## Tier 2\n\n1. Aaa one\n2. Bbb two\n",
  );
  assert.equal(promoted.ok, true, promoted.issues.map((issue) => issue.message).join("\n"));

  const renamed = checkOrdinalPreservation(
    "# Title\n\n## Perf ranking\n\n1. Aaa one\n2. Bbb two\n",
    "# Title\n\n## Performance ranking\n\n1. Aaa one\n2. Bbb two\n",
  );
  assert.equal(renamed.ok, true, renamed.issues.map((issue) => issue.message).join("\n"));
  assert.deepEqual(renamed.warnings.map((warning) => warning.code), ["ordinal-context-ambiguous"]);
});

test("repeated subsection names under different parents do not share a correspondence pool", () => {
  const source = [
    "# Product A",
    "",
    "## Ranking",
    "",
    "1. Alpha Model — note one",
    "2. Bravo Model — note two",
    "3. Charlie Model — note three",
    "",
    "# Product B",
    "",
    "## Ranking",
    "",
    "1. Alpha Model — other one",
    "2. Bravo Model — other two",
    "3. Charlie Model — other three",
    "",
  ].join("\n");
  const aListDeleted = [
    "# Product A",
    "",
    "## Ranking",
    "",
    "# Product B",
    "",
    "## Ranking",
    "",
    "1. Alpha Model — other one",
    "2. Bravo Model — other two",
    "3. Charlie Model — other three",
    "",
  ].join("\n");
  const sectionDeleted = [
    "# Product B",
    "",
    "## Ranking",
    "",
    "1. Alpha Model — other one",
    "2. Bravo Model — other two",
    "3. Charlie Model — other three",
    "",
  ].join("\n");

  // Product A's list is gone but its section remains: hard failure, even
  // though Product B's identically named ranking has the same anchors at
  // the same positions.
  const missing = checkOrdinalPreservation(source, aListDeleted);
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.some((issue) => /different ordered list/u.test(issue.message)));

  // The whole Product A section is gone: ambiguity is reported instead.
  const ambiguous = checkOrdinalPreservation(source, sectionDeleted);
  assert.equal(ambiguous.ok, true, ambiguous.issues.map((issue) => issue.message).join("\n"));
  assert.deepEqual(ambiguous.warnings.map((warning) => warning.code), ["ordinal-context-ambiguous"]);
});

