import assert from "node:assert/strict";
import test from "node:test";
import { compareTokenIndexes, compareTokens, extractTokenIndex, extractTokens } from "../lib/integrity.mjs";
import { formatMarkdown } from "../lib/format.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { readFixture } from "./helpers.mjs";

const PUBKEY = "Test11111111111111111111111111111111111";
const SIGNATURE = "TestSignature11111111111111111111111111111111111111111111111111111111111111111111111111";
const HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("extracts each protected token class from the technical fixture", async () => {
  const tokens = extractTokens(await readFixture("technical-content.md"));
  for (const token of [
    "https://api.example.com/v2/wallets",
    PUBKEY,
    SIGNATURE,
    HEX,
    "1.2.3",
    "v1.2.3",
    "1.2.3-beta.1",
    "v1.2.3+build.7",
    "~/Projects/x",
    "./scripts/format-markdown.mjs",
    "../docs/architecture.md",
    "/usr/local/bin/node",
    "API_KEY",
    "DATABASE_URL",
    "RPC_ENDPOINT",
    "2026-08-15",
    "15/08/2026",
    "12%",
    "$4.00",
    "£4.00",
    "€4.00",
    "export API_KEY=example",
  ]) {
    assert.ok(tokens.has(token), `missing ${token}`);
  }
});

test("does not treat CURRENT VERDICT as an environment variable", async () => {
  const tokens = extractTokens(await readFixture("technical-content.md"));
  assert.equal(tokens.has("CURRENT VERDICT"), false);
  assert.equal(tokens.has("CURRENT"), false);
  assert.equal(tokens.has("VERDICT"), false);
});

test("mutating a mint address fails comparison", () => {
  const before = extractTokens(`Wallet ${PUBKEY}`);
  const after = extractTokens("Wallet Test11111111111111111111111111111111112");
  const result = compareTokens(before, after);
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes(PUBKEY));
});

test("wrapping the same address in backticks still preserves the token", () => {
  const before = extractTokens(`Wallet ${PUBKEY}`);
  const after = extractTokens(`Wallet \`${PUBKEY}\``);
  assert.equal(compareTokens(before, after).ok, true);
});

test("mutating trailing punctuation in protected code fails comparison", () => {
  const before = extractTokens("Use `let x = 1.` in the snippet.\n\n```js\nconst y = 2.\n```\n");
  const after = extractTokens("Use `let x = 1` in the snippet.\n\n```js\nconst y = 2\n```\n");
  const result = compareTokens(before, after);
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("let x = 1."));
  assert.ok(result.missing.includes("const y = 2."));
});

test("deleting a URL fails comparison", () => {
  const before = extractTokens("See https://example.com/a");
  const after = extractTokens("See the docs.");
  const result = compareTokens(before, after);
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("https://example.com/a"));
});

test("reducing duplicate occurrences of the same token still passes", () => {
  const before = extractTokens(`${PUBKEY} and again ${PUBKEY}`);
  const after = extractTokens(PUBKEY);
  assert.equal(compareTokens(before, after).ok, true);
});

test("extracts Windows drive-letter paths as protected tokens", () => {
  const tokens = extractTokens("See C:\\Users\\mark\\notes.md and C:/Users/mark/docs/architecture.md.");
  assert.equal(tokens.has("C:\\Users\\mark\\notes.md"), true);
  assert.equal(tokens.has("C:/Users/mark/docs/architecture.md"), true);
});

test("extracts camelCase and snake_case identifiers as exact tokens", () => {
  const tokens = extractTokens("Use apiKey and session_signer in the request.");
  assert.equal(tokens.has("apiKey"), true);
  assert.equal(tokens.has("session_signer"), true);
});

test("prefix or suffix on an identifier is not the same token", () => {
  const before = extractTokens("The field is apiKey.");
  assert.equal(compareTokens(before, "The field is apiKey.").ok, true);
  const prefixed = compareTokens(before, "The field is apiKeyName.");
  const suffixed = compareTokens(before, "The field is myapiKey.");
  assert.equal(prefixed.ok, false);
  assert.ok(prefixed.missing.includes("apiKey"));
  assert.equal(suffixed.ok, false);
  assert.ok(suffixed.missing.includes("apiKey"));
});

test("formatting the technical fixture does not drop protected tokens", async () => {
  const original = await readFixture("technical-content.md");
  const formatted = await formatMarkdown(original);
  assert.equal(compareTokens(extractTokens(original), extractTokens(formatted)).ok, true);
});

test("losing inline-code formatting around an identifier fails class-aware comparison", () => {
  const result = compareTokenIndexes(extractTokenIndex("`API_KEY` is required."), extractTokenIndex("API_KEY is required."));
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("`API_KEY`"));
});

test("changing a currency amount fails comparison", () => {
  const result = compareTokenIndexes(extractTokenIndex("Pay $1,000 now."), extractTokenIndex("Pay $100 now."));
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("$1,000"));
});

test("shortening a relative file path fails comparison", () => {
  const result = compareTokenIndexes(extractTokenIndex("See docs/config.md."), extractTokenIndex("See config.md."));
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("docs/config.md"));
});

test("dropping variable sigils fails comparison", () => {
  const result = compareTokenIndexes(extractTokenIndex("Set ${TOKEN} today."), extractTokenIndex("Set TOKEN today."));
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("${TOKEN}"));
});

test("rewording a prose-only identifier warns instead of failing", async () => {
  const result = await verifyMarkdown("Use fetch for reads.\n", { integrityFromText: "Use getTransaction for reads.\n" });
  assert.equal(result.ok, true, result.errors.join("\n"));
  const warning = result.integrityCoverage.warnings.find((item) => item.code === "possibly-changed-prose-token");
  assert.ok(warning, JSON.stringify(result.integrityCoverage.warnings));
  assert.deepEqual(warning.examples, ["getTransaction"]);
});

test("renaming a code-backed identifier still fails verification", async () => {
  const result = await verifyMarkdown("Call `fetchRecord` now.\n", { integrityFromText: "Call `getTransaction` now.\n" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /getTransaction/.test(error)));
});

test("consolidating duplicate protected tokens warns instead of failing", async () => {
  const result = await verifyMarkdown("See https://example.com/a.\n", {
    integrityFromText: "See https://example.com/a and https://example.com/a again.\n",
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.ok(
    result.integrityCoverage.warnings.some((item) => item.code === "decreased-protected-token-count"),
    JSON.stringify(result.integrityCoverage.warnings),
  );
});

test("changing one of two identical payments fails verification", async () => {
  const source = "The initial payment is £500.\n\nThe final payment is £500.\n";
  const mutated = await verifyMarkdown("The initial payment is £500.\n\nThe final payment is £50.\n", {
    integrityFromText: source,
  });
  assert.equal(mutated.ok, false);
  assert.ok(mutated.errors.some((error) => /changed: £500 → £50/.test(error)), mutated.errors.join("\n"));
  const consolidated = await verifyMarkdown("The payment is £500.\n", { integrityFromText: source });
  assert.equal(consolidated.ok, true, consolidated.errors.join("\n"));
  const consolidationWarning = consolidated.integrityCoverage.warnings.find(
    (item) => item.code === "decreased-protected-token-count",
  );
  assert.ok(consolidationWarning, JSON.stringify(consolidated.integrityCoverage.warnings));
  assert.match(consolidationWarning.message, /2 → 1/);
});

test("shifting occurrences between existing values fails verification", async () => {
  const result = await verifyMarkdown("£500, £50, £50.\n", { integrityFromText: "£500, £500, £50.\n" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /changed: £500 → £50/.test(error)), result.errors.join("\n"));
});

test("replacing a single protected value fails verification", async () => {
  const result = await verifyMarkdown("Pay £50.\n", { integrityFromText: "Pay £500.\n" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /missing: £500/.test(error)), result.errors.join("\n"));
});

test("removing a strongly protected value entirely fails verification", async () => {
  const result = compareTokenIndexes(
    extractTokenIndex("See https://example.com/a.\n"),
    extractTokenIndex("See the docs.\n"),
  );
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("https://example.com/a"));
});

test("moving a literal into code still passes without false mutations", async () => {
  const promoted = await verifyMarkdown("The `£500` fee.\n", { integrityFromText: "The £500 fee.\n" });
  assert.equal(promoted.ok, true, promoted.errors.join("\n"));
});

test("moving a literal out of code fails on structure, not on value mutation", async () => {
  const demoted = await verifyMarkdown("The £500 fee.\n", { integrityFromText: "The `£500` fee.\n" });
  assert.equal(demoted.ok, false);
  assert.ok(demoted.errors.some((error) => /missing: `£500`/.test(error)), demoted.errors.join("\n"));
  assert.ok(!demoted.errors.some((error) => /changed:/.test(error)), demoted.errors.join("\n"));
});

test("identical values across prose and link nodes count actual occurrences", async () => {
  const before = extractTokenIndex("See https://example.com/a and [the docs](https://example.com/a).\n");
  assert.equal(before.classes.url.get("https://example.com/a"), 2);
  const result = await verifyMarkdown("See https://example.com/a.\n", {
    integrityFromText: "See https://example.com/a and [the docs](https://example.com/a).\n",
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
  const warning = result.integrityCoverage.warnings.find((item) => item.code === "decreased-protected-token-count");
  assert.ok(warning, JSON.stringify(result.integrityCoverage.warnings));
  assert.match(warning.message, /2 → 1/);
});
