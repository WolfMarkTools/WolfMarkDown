import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { formatMarkdown } from "../lib/format.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { skillRoot } from "./helpers.mjs";

const inputPath = join(skillRoot, "tests", "fixtures", "input", "solana-wallet-payment-architecture.md");
const evidencePath = join(skillRoot, "tests", "fixtures", "evidence", "solana-wallet-payment-architecture.bad-output.md");
const evalPath = join(skillRoot, "tests", "evals", "solana-wallet-payment-architecture.md");

test("Solana report regression keeps semantic assertions separate from deterministic proof", async () => {
  const source = await readFile(inputPath, "utf8");
  const evidence = await readFile(evidencePath, "utf8");
  const semanticEval = await readFile(evalPath, "utf8");
  const formatted = await formatMarkdown(source);
  const deterministicResult = await verifyMarkdown(formatted, { integrityFromText: source });

  assert.equal(deterministicResult.ok, true, deterministicResult.errors.join("\n"));
  assert.match(evidence, /⚬ Status:/u);
  assert.match(evidence, /Comprehensive Provider and Primitive Feature Comparison Matrix/u);
  for (const assertion of [
    /at least five valid GFM tables/u,
    /standalone section boundaries as headings/u,
    /repeated `⚬ Label: value` structures/u,
    /distinct sibling sections/u,
    /readable paragraphs/u,
    /protected values and identifiers/u,
  ]) {
    assert.match(semanticEval, assertion);
  }
});
