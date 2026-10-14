import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkCitations, findAdjacentCitationPairs, separateAdjacentCitations } from "../lib/citations.mjs";
import { formatMarkdown } from "../lib/format.mjs";
import { maskMarkdownNodes } from "../lib/preservation.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { readFixture } from "./helpers.mjs";

const formatScript = fileURLToPath(new URL("../scripts/format-markdown.mjs", import.meta.url));

const maskCode = (text) => maskMarkdownNodes(text, ["inlineCode"]);

const ledger = "\n\n## Sources\n\n[1] alpha\n[2] beta\n[3] gamma\n";

test("safe fixes separate every citation boundary in one pass and are idempotent", async () => {
  for (const chain of ["[1][2][3]", "[1][2][3][4]", "[10][20][30][40][50]"]) {
    const input = `# Doc\n\nClaim ${chain}.${ledger}`;
    const result = separateAdjacentCitations(input);
    assert.equal(result.applied, chain.match(/\[/gu).length - 1);
    assert.ok(result.text.includes(chain.replaceAll("][", "] [")));
    assert.equal(checkCitations(result.text).ok, true);
    assert.equal((await verifyMarkdown(await formatMarkdown(result.text))).ok, true);
    assert.deepEqual(separateAdjacentCitations(result.text), { text: result.text, applied: 0 });
  }
});

test("safe fixes preserve parsed reference links, images and inline links in chains", () => {
  for (const body of [
    "Claim [1][2][3].\n\n[2]: /target",
    "Claim [1][2][3].\n\n[3]: /target",
    "Claim [1][2].\n\n> [2]: /target",
    "Claim [1][2](/target).",
    "Claim ![1][2].\n\n[2]: /target",
  ]) {
    const input = `# Doc\n\n${body}${ledger}`;
    assert.deepEqual(separateAdjacentCitations(input), { text: input, applied: 0 }, body);
    assert.equal(checkCitations(input).ok, true, body);
  }
});

test("reference-shaped text in code does not hide a live citation issue", () => {
  const input = `# Doc\n\nOpen \`code\n[2]: /target\nend\`\n\nClaim [1][2].${ledger}`;
  assert.equal(checkCitations(input).ok, false);
  assert.equal(separateAdjacentCitations(input).applied, 1);
});

test("a multiline code ledger cannot enable safe fixes or cross-reference warnings", () => {
  const input = "# Doc\n\nOpen `code\n[1] alpha\n[2] beta\n[3] gamma\nend`\n\nClaim [1][9].\n";
  assert.deepEqual(separateAdjacentCitations(input), { text: input, applied: 0 });
  assert.deepEqual(checkCitations(input, { crossReference: true }).warnings, []);
});

test("adjacent numeric citation pairs are detected only in live text", () => {
  assert.equal(findAdjacentCitationPairs("Claim [6][26] continues.\n").length, 1);
  assert.equal(findAdjacentCitationPairs("Claim [6] [26] continues.\n").length, 0);
  assert.equal(findAdjacentCitationPairs("Code `[6][26]` span.\n").length, 0);
  assert.equal(findAdjacentCitationPairs("Escaped \\[6\\]\\[26\\].\n").length, 0);
  assert.equal(findAdjacentCitationPairs("```\n[6][26]\n```\n").length, 0);
  assert.equal(findAdjacentCitationPairs("    [6][26]\n").length, 0);
});

test("checkCitations fails undefined pairs with a citation-specific remediation", () => {
  const result = checkCitations("Claim [6][26] continues.\n");
  assert.equal(result.ok, false);
  assert.match(result.issues[0].message, /\[6\] \[26\]/u);
  assert.match(result.issues[0].remediation, /Separate adjacent numeric citations/u);
});

test("defined right labels are genuine reference links and are not flagged", () => {
  const text = "Claim [6][26] continues.\n\n[26]: https://example.com/target\n";
  assert.equal(checkCitations(text).ok, true);
  assert.equal(findAdjacentCitationPairs(text).length, 0);
});

test("verifyMarkdown reports citations and deduplicates the MD052 finding", async () => {
  const result = await verifyMarkdown("# Title\n\nClaim [6][26] continues.\n");
  assert.equal(result.checks.citations, false);
  assert.equal(result.checks.markdownlint, true, result.errors.join("\n"));
  assert.ok(result.issues.some((issue) => issue.check === "citations"));
  assert.ok(!result.issues.some((issue) => issue.check === "markdownlint"));
});

test("ledger cross-reference warnings only when requested and only for unknown labels", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const clean = checkCitations(source, { crossReference: true });
  assert.equal(clean.warnings.length, 0);

  const withMissing = source.replace("Alpha Model leads the group [1] [3].", "Alpha Model leads the group [1] [9].");
  const gated = checkCitations(withMissing, { crossReference: true });
  assert.ok(
    gated.warnings.some((warning) => warning.code === "citation-not-in-ledger" && warning.examples.includes("[9]")),
  );
  const ungated = checkCitations(withMissing);
  assert.equal(ungated.warnings.length, 0);
});

test("safe fixes separate adjacent citations only in recognised ledgers", async () => {
  const source = await readFixture("synthetic-sources-ledger.md");
  const withPair = source.replace("Alpha Model leads the group [1] [3].", "Alpha Model leads the group [1][2].");
  const fixed = separateAdjacentCitations(withPair);
  assert.equal(fixed.applied, 1);
  assert.ok(fixed.text.includes("[1] [2]"));
  assert.equal(separateAdjacentCitations(fixed.text).applied, 0);

  const noLedger = "# T\n\nClaim [6][26].\n";
  const noLedgerResult = separateAdjacentCitations(noLedger);
  assert.equal(noLedgerResult.applied, 0);
  assert.equal(noLedgerResult.text, noLedger);

  const guarded = source.replace(
    "Alpha Model leads the group [1] [3].",
    "Alpha cites `[1][2]` and \\[1\\]\\[2\\] in code and escapes.",
  );
  assert.equal(separateAdjacentCitations(guarded).applied, 0);

  const genuine = source.replace(
    "Alpha Model leads the group [1] [3].",
    "Alpha cites [1][9].\n\n[9]: https://example.com/target",
  );
  assert.equal(separateAdjacentCitations(genuine).applied, 0);
});

test("format --safe-fixes applies the repair; plain format leaves the pair", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-citations-"));
  const source = await readFixture("synthetic-sources-ledger.md");
  const withPair = source.replace("Alpha Model leads the group [1] [3].", "Alpha Model leads the group [1][2].");
  const file = join(dir, "doc.md");
  await writeFile(file, withPair);

  execFileSync(process.execPath, [formatScript, file], { encoding: "utf8" });
  assert.ok((await readFile(file, "utf8")).includes("[1][2]"));

  await writeFile(file, withPair);
  execFileSync(process.execPath, [formatScript, file, "--safe-fixes"], { encoding: "utf8" });
  const after = await readFile(file, "utf8");
  assert.ok(after.includes("[1] [2]"));
  assert.ok(!after.includes("[1][2]"));
});

test("multi-backtick code spans are masked by delimiter run, not by pairing", () => {
  const singleTick = maskCode("See `[1][2]` span.");
  assert.ok(!singleTick.includes("[1][2]") && !singleTick.includes("`"), JSON.stringify(singleTick));
  assert.equal(singleTick.length, "See `[1][2]` span.".length);

  const doubleTick = maskCode("See ``[1][2]`` span.");
  assert.ok(!doubleTick.includes("[1][2]") && !doubleTick.includes("`"), JSON.stringify(doubleTick));
  assert.equal(doubleTick.length, "See ``[1][2]`` span.".length);

  const fourTick = maskCode("See ````[1][2]```` span.");
  assert.ok(!fourTick.includes("[1][2]") && !fourTick.includes("`"), JSON.stringify(fourTick));
  assert.equal(fourTick.length, "See ````[1][2]```` span.".length);

  const doc = [
    "# Doc",
    "",
    "See ``[1][2]`` in code and [1][2] live.",
    "",
    "## Sources",
    "",
    "[1] https://example.com/a",
    "[2] https://example.com/b",
    "[3] https://example.com/c",
    "",
  ].join("\n");
  const docLine = doc.split("\n")[2];
  const codeEnd = docLine.lastIndexOf("`");
  const pairs = findAdjacentCitationPairs(doc);
  assert.equal(pairs.length, 1, JSON.stringify(pairs));
  assert.ok(pairs[0].column - 1 > codeEnd, "the detected pair must be the live text, not the code span");

  const fixed = separateAdjacentCitations(doc);
  assert.equal(fixed.applied, 1);
  const fixedLine = fixed.text.split("\n").find((line) => line.includes("in code"));
  assert.ok(fixedLine.includes("``[1][2]``"), fixedLine);
  assert.ok(fixedLine.includes("[1] [2] live"), fixedLine);
});

test("multiline code spans are masked during detection and safe fixes", () => {
  const doc = [
    "# Doc",
    "",
    "Open `inline code",
    "[1][2]",
    "continues` here.",
    "",
    "## Sources",
    "",
    "[1] https://example.com/a",
    "[2] https://example.com/b",
    "[3] https://example.com/c",
    "",
  ].join("\n");

  assert.equal(findAdjacentCitationPairs(doc).length, 0);

  const fixed = separateAdjacentCitations(doc);
  assert.equal(fixed.applied, 0);
  assert.equal(fixed.text, doc);
});

test("--check --safe-fixes fails when a write pass would change the input", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-citations-"));
  const source = await readFixture("synthetic-sources-ledger.md");
  const withPair = source
    .replace(/^(\[\d+\] .*)$/gmu, "$1  ")
    .replace("Alpha Model leads the group [1] [3].", "Alpha Model leads the group [1][2].");
  const file = join(dir, "doc.md");
  // An already-formatted candidate whose ledger is printer-surviving: the
  // only difference a check with safe fixes should see is the citation pair.
  await writeFile(file, await formatMarkdown(withPair));

  // The pair alone is not a formatting problem: a plain check passes.
  const cleanCheck = execFileSync(process.execPath, [formatScript, file, "--check"], { encoding: "utf8" });
  assert.match(cleanCheck, /already formatted/u);

  // With safe fixes requested, the same file must fail the check because a
  // write pass would still change it.
  let exitCode = 0;
  let stderr = "";
  try {
    execFileSync(process.execPath, [formatScript, file, "--check", "--safe-fixes"], { encoding: "utf8" });
  } catch (error) {
    exitCode = error.status;
    stderr = error.stderr;
  }
  assert.equal(exitCode, 1);
  assert.match(stderr, /would be applied/u);
  assert.match(stderr, /requires safe fixes/u);

  // Check mode never writes: the pair is still in the file.
  assert.ok((await readFile(file, "utf8")).includes("[1][2]"));
});

test("reference definitions with markdown label whitespace are normalised", async () => {
  const padded = "Claim [6][26] continues.\n\n[ 26 ]: https://example.com/target\n";
  assert.equal(checkCitations(padded).ok, true);
  assert.equal(findAdjacentCitationPairs(padded).length, 0);

  const source = await readFixture("synthetic-sources-ledger.md");
  const genuine = source.replace(
    "Alpha Model leads the group [1] [3].",
    "Alpha cites [1][9].\n\n[ 9 ]: https://example.com/target",
  );
  assert.equal(separateAdjacentCitations(genuine).applied, 0);
});

test("pairs inside container-prefixed fenced code are never modified", () => {
  const doc = [
    "# Doc",
    "",
    "> ```text",
    "> [1][2]",
    "> ```",
    "",
    "## Sources",
    "",
    "[1] https://example.com/a",
    "[2] https://example.com/b",
    "[3] https://example.com/c",
    "",
  ].join("\n");

  assert.equal(findAdjacentCitationPairs(doc).length, 0);
  assert.equal(checkCitations(doc).ok, true);

  const fixed = separateAdjacentCitations(doc);
  assert.equal(fixed.applied, 0);
  assert.equal(fixed.text, doc);
});
