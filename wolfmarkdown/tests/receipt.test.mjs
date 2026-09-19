import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectMarkdownTargets } from "../lib/batch.mjs";
import { parseFlags } from "../lib/cli.mjs";
import { formatMarkdown } from "../lib/format.mjs";
import { integrityCoverage } from "../lib/integrity.mjs";
import { previewDocuments } from "../lib/preview.mjs";
import { QUALITY_BOUNDARY, toReceipt } from "../lib/report.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { readFixture, skillRoot } from "./helpers.mjs";

test("issues include a check name, message, and remediation", async () => {
  const result = await verifyMarkdown("# Title");
  assert.equal(result.ok, false);
  assert.ok(result.issues.length > 0);
  const whitespace = result.issues.find((issue) => issue.check === "whitespace");
  assert.ok(whitespace);
  assert.match(whitespace.message, /newline/i);
  assert.match(whitespace.remediation, /newline/i);
});

test("prettier failures include a formatting remediation", async () => {
  const result = await verifyMarkdown("# Title\n\nHello   \n");
  const prettier = result.issues.find((issue) => issue.check === "prettier");
  assert.ok(prettier, result.errors.join("\n"));
  assert.match(prettier.remediation, /format-markdown/i);
});

test("integrity coverage warns about uncovered shapes without failing", async () => {
  const markdown = await formatMarkdown(
    ["# Title", "", "Node 18.17 shipped in May 2027 with build 42.", "Use 1.2.3 in production.", ""].join("\n"),
  );
  const result = await verifyMarkdown(markdown);
  assert.equal(result.ok, true, result.errors.join("\n"));
  const codes = result.integrityCoverage.warnings.map((warning) => warning.code);
  assert.ok(codes.includes("unprotected-isolated-integer"));
  assert.ok(codes.includes("unprotected-two-part-version"));
  assert.ok(codes.includes("unprotected-month-name-date"));
  assert.deepEqual(result.integrityCoverage.warnings.find((warning) => warning.code === "unprotected-two-part-version").examples, [
    "18.17",
  ]);
  assert.equal(result.integrityCoverage.checked, false);
});

test("three-part versions are not reported as unprotected two-part versions", () => {
  const coverage = integrityCoverage("Release 1.2.3 and v1.2.3-beta.1.\n");
  assert.equal(
    coverage.warnings.some((warning) => warning.code === "unprotected-two-part-version"),
    false,
  );
  assert.ok(coverage.classes.semver.count >= 1);
});

test("toReceipt includes hashes, versions, coverage, and the quality boundary", async () => {
  const formatted = await formatMarkdown(await readFixture("already-clean.md"));
  const result = await verifyMarkdown(formatted, { integrityFromText: formatted });
  const { version } = JSON.parse(await readFile(join(skillRoot, "package.json"), "utf8"));
  const receipt = toReceipt(result, {
    candidatePath: "already-clean.md",
    candidateText: formatted,
    integrityFromPath: "source.md",
    integrityFromText: formatted,
  });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.qualityBoundary, QUALITY_BOUNDARY);
  assert.equal(receipt.versions.wolfmarkdown, version);
  assert.equal(typeof receipt.files.candidate.hash, "string");
  assert.equal(receipt.files.candidate.hash.length, 64);
  assert.equal(receipt.files.integrityFrom.path, "source.md");
  assert.equal(receipt.integrityCoverage.checked, true);
  assert.equal(receipt.checks.integrity, "pass");
  assert.deepEqual(receipt.errors, []);
});

test("preview reports observable structure and scaffolding without judging semantics", async () => {
  const source = ["Assistant: Sure, here's the note.", "", "Comparison A | B", "Use relay_v2.", ""].join("\n");
  const candidate = await formatMarkdown(
    ["# Note", "", "Use `relay_v2`.", ""].join("\n"),
  );
  const preview = await previewDocuments(source, candidate, { destination: "note.md" });
  assert.equal(preview.destination, "note.md");
  assert.equal(preview.unchanged, false);
  assert.equal(preview.formattingOnly, false);
  assert.ok(preview.structure.headings.candidate >= 1);
  assert.ok(preview.scaffolding.source > preview.scaffolding.candidate);
  assert.equal(preview.protectedTokens.preserved, true);
  assert.match(preview.note, /does not judge/i);
});

test("parseFlags treats --receipt as a path flag", () => {
  const parsed = parseFlags(["notes.md", "--receipt", "out.json", "--preview"], ["--receipt", "--preview"]);
  assert.equal(parsed.flags.receipt, "out.json");
  assert.equal(parsed.flags.preview, true);
  assert.deepEqual(parsed.positionals, ["notes.md"]);
  assert.throws(() => parseFlags(["--receipt"], ["--receipt"]), /requires a file path/);
});

test("verify --json prints a receipt and batch results keep per-file evidence", async () => {
  const formatted = await formatMarkdown("# Title\n\nKeep this.\n");
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-batch-"));
  const first = join(dir, "a.md");
  const nested = join(dir, "nested");
  await mkdir(nested);
  const second = join(nested, "b.md");
  await writeFile(first, formatted);
  await writeFile(second, formatted);
  const receiptPath = join(dir, "receipt.json");
  const ran = spawnSync(
    process.execPath,
    [join(skillRoot, "scripts", "verify-markdown.mjs"), dir, "--json", "--preview", "--receipt", receiptPath],
    { encoding: "utf8" },
  );
  const files = await collectMarkdownTargets([dir]);
  assert.deepEqual(files, [first, second].sort((left, right) => left.localeCompare(right)));
  assert.equal(ran.status, 0, ran.stderr);
  const body = JSON.parse(ran.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.qualityBoundary, QUALITY_BOUNDARY);
  assert.equal(body.results.length, 2);
  assert.ok(body.results.every((entry) => entry.preview?.note));
  const written = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.deepEqual(written.ok, true);
  await rm(dir, { recursive: true, force: true });
});

test("verify-markdown.mjs reads standard input", async () => {
  const formatted = await formatMarkdown("# Title\n\nKeep this.\n");
  const ran = spawnSync(
    process.execPath,
    [join(skillRoot, "scripts", "verify-markdown.mjs"), "-", "--json"],
    { encoding: "utf8", input: formatted },
  );
  assert.equal(ran.status, 0, ran.stderr);
  const body = JSON.parse(ran.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.files.candidate.path, "-");
});

test("verify-markdown.mjs refuses stdin mixed with files or as --integrity-from", () => {
  const mixed = spawnSync(
    process.execPath,
    [join(skillRoot, "scripts", "verify-markdown.mjs"), "-", "notes.md"],
    { encoding: "utf8", input: "# Title\n" },
  );
  assert.equal(mixed.status, 1);
  assert.match(mixed.stderr, /cannot be combined/);

  const integrity = spawnSync(
    process.execPath,
    [join(skillRoot, "scripts", "verify-markdown.mjs"), "notes.md", "--integrity-from", "-"],
    { encoding: "utf8" },
  );
  assert.equal(integrity.status, 1);
  assert.match(integrity.stderr, /cannot read standard input/);
});
