import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { formatMarkdown } from "../lib/format.mjs";
import { hashText } from "../lib/report.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { readFixture, skillRoot } from "./helpers.mjs";

const scriptPath = fileURLToPath(new URL("../scripts/verify-markdown.mjs", import.meta.url));

function makePrinterStable(source) {
  return source.replace(/^(\[\d+\] .*)$/gmu, "$1  ");
}

function renumberTierTwo(source) {
  return source
    .replace("4. **Delta Model**", "1. **Delta Model**")
    .replace("5. **Echo Model**", "2. **Echo Model**");
}

function collapseLedger(source) {
  const ledger = source.split("\n").filter((line) => /^\[\d+\] /u.test(line)).map((line) => line.trim());
  return source.replace(ledger.join("\n"), ledger.join(" "));
}

test("ranking-and-ledger acceptance: faithful candidate passes; renumbered tiers and collapsed ledger fail", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-acceptance-"));
  const source = await readFixture("synthetic-budget-report.md");
  const sourcePath = join(dir, "source.md");
  const candidatePath = join(dir, "candidate.md");
  await writeFile(sourcePath, source);

  // Faithful Clean: records made printer-surviving, then formatted.
  await writeFile(candidatePath, await formatMarkdown(makePrinterStable(source)));
  const passOutput = execFileSync(
    process.execPath,
    [scriptPath, candidatePath, "--integrity-from", sourcePath, "--preserve-structure", "--json"],
    { encoding: "utf8" },
  );
  const passReceipt = JSON.parse(passOutput);
  assert.equal(passReceipt.ok, true, JSON.stringify(passReceipt.errors));
  assert.equal(passReceipt.checks.ordinals, "pass");
  assert.equal(passReceipt.checks.records, "pass");

  // Corrupted Clean: the Tier 2 positions are reset to 1–2 and the Sources
  // ledger is collapsed, while the cost ranking (which contains the same
  // numbers 4 and 5) stays intact — the exact false-negative shape observed
  // in production testing. Verification must fail with both violations.
  await writeFile(candidatePath, await formatMarkdown(collapseLedger(renumberTierTwo(source))));
  let exitCode = 0;
  let output = "";
  try {
    output = execFileSync(
      process.execPath,
      [scriptPath, candidatePath, "--integrity-from", sourcePath, "--preserve-structure", "--json"],
      { encoding: "utf8" },
    );
  } catch (error) {
    exitCode = error.status;
    output = error.stdout;
  }
  assert.equal(exitCode, 1);
  const receipt = JSON.parse(output);
  assert.equal(receipt.checks.ordinals, "fail");
  assert.equal(receipt.checks.records, "fail");
  const structureMessages = receipt.issues
    .filter((issue) => issue.check === "ordinals" || issue.check === "records")
    .map((issue) => issue.message)
    .join("\n");
  assert.match(structureMessages, /Delta Model/u);
  assert.match(structureMessages, /own line|order or association/u);
});

test("default verification is unchanged; declarations apply without --preserve-structure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-acceptance-"));
  const source = await readFixture("synthetic-budget-report.md");
  const sourcePath = join(dir, "source.md");
  const candidatePath = join(dir, "candidate.md");
  const invariantsPath = join(dir, "invariants.json");
  await writeFile(sourcePath, source);
  await writeFile(candidatePath, await formatMarkdown(collapseLedger(renumberTierTwo(source))));

  // Standalone Verify keeps its existing behaviour: structural checks are
  // skipped unless requested.
  const plainOutput = execFileSync(
    process.execPath,
    [scriptPath, candidatePath, "--integrity-from", sourcePath, "--json"],
    { encoding: "utf8" },
  );
  const plainReceipt = JSON.parse(plainOutput);
  assert.equal(plainReceipt.checks.ordinals, "skip");
  assert.equal(plainReceipt.checks.records, "skip");

  // Compose-style usage: a source-grounded declaration applies the specific
  // preservation requirement without enforcing all original structure.
  const declaration = {
    version: 1,
    sourceSha256: hashText(source),
    preserve: {
      ordinalRuns: [{ id: "tier2", section: "Tier 2 — provisional", start: 4, end: 5 }],
    },
    require: {},
  };
  await writeFile(invariantsPath, JSON.stringify(declaration));
  let exitCode = 0;
  let output = "";
  try {
    output = execFileSync(
      process.execPath,
      [scriptPath, candidatePath, "--integrity-from", sourcePath, "--invariants", invariantsPath, "--json"],
      { encoding: "utf8" },
    );
  } catch (error) {
    exitCode = error.status;
    output = error.stdout;
  }
  assert.equal(exitCode, 1);
  const receipt = JSON.parse(output);
  assert.equal(receipt.checks.invariants, "fail");
  assert.ok(receipt.issues.some((issue) => /Delta Model/u.test(issue.message)));
});

test("mixed emphasis fails MD049 and a consistent resolution passes", async () => {
  const input = await readFixture("mixed-emphasis.md");
  const failing = await verifyMarkdown(await formatMarkdown(input));
  assert.equal(failing.checks.markdownlint, false);
  assert.ok(failing.issues.some((issue) => /MD049/u.test(issue.message)));

  const expected = await readFile(join(skillRoot, "tests", "fixtures", "expected", "mixed-emphasis.md"), "utf8");
  const passing = await verifyMarkdown(await formatMarkdown(expected));
  assert.equal(passing.ok, true, passing.errors.join("\n"));
});
