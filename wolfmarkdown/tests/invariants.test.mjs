import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { formatMarkdown } from "../lib/format.mjs";
import { checkInvariants, parseInvariants } from "../lib/invariants.mjs";
import { hashText } from "../lib/report.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { readFixture } from "./helpers.mjs";

const scriptPath = fileURLToPath(new URL("../scripts/verify-markdown.mjs", import.meta.url));

async function ledgerDeclaration(overrides = {}) {
  const source = await readFixture("synthetic-sources-ledger.md");
  return {
    version: 1,
    sourceSha256: hashText(source),
    preserve: {
      headings: ["Sources"],
      recordRuns: [{ id: "sources", section: "Sources", count: 4 }],
    },
    require: { headings: [] },
    ...overrides,
  };
}

test("parseInvariants accepts a well-formed declaration and normalises the hash", async () => {
  const declaration = await ledgerDeclaration();
  declaration.sourceSha256 = declaration.sourceSha256.toUpperCase();
  const parsed = parseInvariants(JSON.stringify(declaration));
  assert.equal(parsed.ok, true, (parsed.errors ?? []).join("\n"));
  assert.equal(parsed.declaration.sourceSha256, declaration.sourceSha256.toLowerCase());
  assert.equal(parsed.declaration.preserve.recordRuns[0].count, 4);
});

test("parseInvariants rejects malformed, unknown and inconsistent input", () => {
  const checks = [
    ["not json", "{"],
    ["not an object", "[]"],
    ["wrong version", JSON.stringify({ version: 2, sourceSha256: "a".repeat(64) })],
    ["missing hash", JSON.stringify({ version: 1 })],
    ["bad hash", JSON.stringify({ version: 1, sourceSha256: "nope" })],
    ["unknown top key", JSON.stringify({ version: 1, sourceSha256: "a".repeat(64), extra: true })],
    [
      "unknown preserve key",
      JSON.stringify({ version: 1, sourceSha256: "a".repeat(64), preserve: { lists: [] } }),
    ],
    [
      "zero record count",
      JSON.stringify({
        version: 1,
        sourceSha256: "a".repeat(64),
        preserve: { recordRuns: [{ section: "Sources", count: 0 }] },
      }),
    ],
    [
      "ordinal end before start",
      JSON.stringify({
        version: 1,
        sourceSha256: "a".repeat(64),
        preserve: { ordinalRuns: [{ section: "Ranking", start: 6, end: 3 }] },
      }),
    ],
    [
      "unknown require key",
      JSON.stringify({ version: 1, sourceSha256: "a".repeat(64), require: { tables: ["x"] } }),
    ],
  ];
  for (const [label, text] of checks) {
    const parsed = parseInvariants(text);
    assert.equal(parsed.ok, false, `expected rejection: ${label}`);
    assert.ok(parsed.errors.length > 0, label);
  }
});

test("source-grounded declarations pass on an intact candidate and record evidence", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const declaration = (await ledgerDeclaration()).preserve;
  const parsed = parseInvariants(
    JSON.stringify({ version: 1, sourceSha256: hashText(source), preserve: declaration, require: {} }),
  );
  const result = checkInvariants({
    declaration: parsed.declaration,
    sourceText: source,
    candidateText: source,
  });
  assert.equal(result.ok, true, result.issues.map((issue) => issue.message).join("\n"));
  assert.equal(result.evidence.sourceMatched, true);
  assert.equal(result.evidence.preserved, 2);
});

test("incorrect declarations are rejected against the untouched source", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");

  const wrongHeading = parseInvariants(
    JSON.stringify({
      version: 1,
      sourceSha256: hashText(source),
      preserve: { headings: ["Not In Source"] },
      require: {},
    }),
  ).declaration;
  const headingResult = checkInvariants({ declaration: wrongHeading, sourceText: source, candidateText: source });
  assert.equal(headingResult.ok, false);
  assert.ok(headingResult.issues.some((issue) => /not source-grounded/u.test(issue.message)));

  const wrongCount = parseInvariants(
    JSON.stringify({
      version: 1,
      sourceSha256: hashText(source),
      preserve: { recordRuns: [{ section: "Sources", count: 99 }] },
      require: {},
    }),
  ).declaration;
  const countResult = checkInvariants({ declaration: wrongCount, sourceText: source, candidateText: source });
  assert.equal(countResult.ok, false);
  assert.ok(countResult.issues.some((issue) => /declared 99, found 4/u.test(issue.message)));

  const wrongOrdinal = parseInvariants(
    JSON.stringify({
      version: 1,
      sourceSha256: hashText(source),
      preserve: { ordinalRuns: [{ section: "Findings", start: 11, end: 16 }] },
      require: {},
    }),
  ).declaration;
  const ordinalResult = checkInvariants({ declaration: wrongOrdinal, sourceText: source, candidateText: source });
  assert.equal(ordinalResult.ok, false);
  assert.ok(ordinalResult.issues.some((issue) => /not source-grounded: no ordered sequence/u.test(issue.message)));
});

test("a declaration bound to a different snapshot is refused", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const declaration = parseInvariants(
    JSON.stringify({ version: 1, sourceSha256: hashText("something else"), preserve: {}, require: {} }),
  ).declaration;
  const result = checkInvariants({ declaration, sourceText: source, candidateText: source });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => /different source snapshot/u.test(issue.message)));
});

test("declared ordinal preservation fails on a renumbered candidate without --preserve-structure", async () => {
  const source = await readFixture("synthetic-two-rankings.md");
  const corrupted = source
    .replace("3. **Charlie Model**", "1. **Charlie Model**")
    .replace("4. **Delta Model**", "2. **Delta Model**");
  const declaration = parseInvariants(
    JSON.stringify({
      version: 1,
      sourceSha256: hashText(source),
      preserve: {
        ordinalRuns: [{ id: "tier2", section: "Tier 2 — provisional candidates", start: 3, end: 4 }],
      },
      require: {},
    }),
  ).declaration;
  const result = await verifyMarkdown(corrupted, { integrityFromText: source, invariants: declaration });
  assert.equal(result.checks.invariants, false);
  assert.equal(result.checks.ordinals, null);
  assert.ok(result.issues.some((issue) => /Charlie Model/u.test(issue.message)));
  assert.equal(result.invariantsEvidence.sourceMatched, true);

  const faithful = await verifyMarkdown(await formatMarkdown(source), {
    integrityFromText: source,
    invariants: declaration,
  });
  assert.equal(faithful.checks.invariants, true, faithful.errors.join("\n"));
});

test("preserved headings must survive; required headings are candidate-only", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const renamed = source.replace("## Sources", "## References");
  const preserveDeclaration = parseInvariants(
    JSON.stringify({
      version: 1,
      sourceSha256: hashText(source),
      preserve: { headings: ["Sources"] },
      require: {},
    }),
  ).declaration;
  const missing = await verifyMarkdown(renamed, { integrityFromText: source, invariants: preserveDeclaration });
  assert.equal(missing.checks.invariants, false);
  assert.ok(missing.issues.some((issue) => /Preserved heading is missing/u.test(issue.message)));

  const requireDeclaration = parseInvariants(
    JSON.stringify({
      version: 1,
      sourceSha256: hashText(source),
      preserve: {},
      require: { headings: ["References"] },
    }),
  ).declaration;
  const satisfied = await verifyMarkdown(renamed, { integrityFromText: source, invariants: requireDeclaration });
  assert.equal(satisfied.checks.invariants, true, satisfied.errors.join("\n"));

  const unsatisfied = await verifyMarkdown(await formatMarkdown(renamed), {
    integrityFromText: source,
    invariants: parseInvariants(
      JSON.stringify({
        version: 1,
        sourceSha256: hashText(source),
        preserve: {},
        require: { headings: ["Conclusions"] },
      }),
    ).declaration,
  });
  assert.equal(unsatisfied.checks.invariants, false);
  assert.ok(unsatisfied.issues.some((issue) => /Required heading is missing/u.test(issue.message)));
});

test("a collapsed ledger fails a declared record count", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const collapsed = [
    "# Synthetic ledger fixture",
    "",
    "## Sources",
    "",
    "[1] https://example.com/one [2] https://example.com/two [3] https://example.com/three [4] https://example.com/four",
    "",
  ].join("\n");
  const declaration = (await ledgerDeclaration()).preserve;
  const parsed = parseInvariants(
    JSON.stringify({ version: 1, sourceSha256: hashText(source), preserve: declaration, require: {} }),
  ).declaration;
  const result = await verifyMarkdown(collapsed, { integrityFromText: source, invariants: parsed });
  assert.equal(result.checks.invariants, false);
  assert.ok(result.issues.some((issue) => /Declared records are not preserved/u.test(issue.message)));
});

test("CLI: --invariants requires a snapshot and records evidence in the receipt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-invariants-"));
  const source = await readFixture("synthetic-sources-ledger.md");
  const sourcePath = join(dir, "source.md");
  const candidatePath = join(dir, "candidate.md");
  const invariantsPath = join(dir, "invariants.json");
  const declaration = await ledgerDeclaration();
  await writeFile(sourcePath, source);
  // A ledger must be made printer-surviving before formatting: plain
  // format(source) collapses the records, which is itself a violation.
  await writeFile(candidatePath, await formatMarkdown(source.replace(/^(\[\d+\] .*)$/gmu, "$1  ")));
  await writeFile(invariantsPath, JSON.stringify(declaration));

  const stdout = execFileSync(
    process.execPath,
    [scriptPath, candidatePath, "--integrity-from", sourcePath, "--invariants", invariantsPath, "--json"],
    { encoding: "utf8" },
  );
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.checks.invariants, "pass");
  assert.equal(receipt.invariants.sourceMatched, true);
  assert.equal(receipt.files.invariants.path, invariantsPath);
  assert.match(receipt.files.invariants.hash, /^[0-9a-f]{64}$/u);

  let failed = false;
  try {
    execFileSync(process.execPath, [scriptPath, candidatePath, "--invariants", invariantsPath], { encoding: "utf8" });
  } catch (error) {
    failed = true;
    assert.match(error.stderr, /requires --integrity-from/u);
  }
  assert.equal(failed, true);
});

test("declared section invariants fail when the sequence left its context", () => {
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
  const declaration = parseInvariants(
    JSON.stringify({
      version: 1,
      sourceSha256: hashText(source),
      preserve: { ordinalRuns: [{ id: "perf", section: "Performance ranking", start: 1, end: 3 }] },
      require: {},
    }),
  ).declaration;
  const result = checkInvariants({ declaration, sourceText: source, candidateText: headingKept });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => /different ordered list/u.test(issue.message)));
});

test("ambiguity warnings from declared ordinal checks reach the result and receipt", async () => {
  const source = ["# Doc", "", "## Rankings", "", "1. Alpha", "2. Bravo", "3. Charlie", "4. Delta", ""].join("\n");
  const candidate = [
    "# Doc",
    "",
    "## Rankings",
    "",
    "1. Alpha",
    "2. Renamed One",
    "3. Renamed Two",
    "4. Renamed Three",
    "",
  ].join("\n");
  const declaration = parseInvariants(
    JSON.stringify({
      version: 1,
      sourceSha256: hashText(source),
      preserve: { ordinalRuns: [{ id: "ranks", section: "Rankings", start: 1, end: 4 }] },
      require: {},
    }),
  ).declaration;

  const result = checkInvariants({ declaration, sourceText: source, candidateText: candidate });
  assert.equal(result.ok, true, result.issues.map((issue) => issue.message).join("\n"));
  assert.deepEqual(result.warnings.map((warning) => warning.code), ["ordinal-context-ambiguous"]);

  const verified = await verifyMarkdown(candidate, { integrityFromText: source, invariants: declaration });
  assert.ok(verified.warnings.some((warning) => warning.code === "ordinal-context-ambiguous"));
});

test("declared ordinal invariants only enforce their declared range", () => {
  const items = [
    "1. Alpha one",
    "2. Bravo two",
    "3. Charlie three",
    "4. Delta four",
    "5. Echo five",
    "6. Foxtrot six",
    "7. Golf seven",
    "8. Hotel eight",
    "9. India nine",
    "10. Juliett ten",
  ];
  const source = ["# Doc", "", "## Ranking", "", ...items, ""].join("\n");
  const declaration = parseInvariants(
    JSON.stringify({
      version: 1,
      sourceSha256: hashText(source),
      preserve: { ordinalRuns: [{ id: "mid", section: "Ranking", start: 3, end: 4 }] },
      require: {},
    }),
  ).declaration;

  // A change outside the declared range does not fail the declared invariant.
  const outside = source.replace("9. India nine", "9. Renamed nine");
  const relaxed = checkInvariants({ declaration, sourceText: source, candidateText: outside });
  assert.equal(relaxed.ok, true, relaxed.issues.map((issue) => issue.message).join("\n"));

  // A change inside the declared range still fails.
  const inside = source.replace("4. Delta four", "4. Renamed four");
  const strict = checkInvariants({ declaration, sourceText: source, candidateText: inside });
  assert.equal(strict.ok, false);
});

