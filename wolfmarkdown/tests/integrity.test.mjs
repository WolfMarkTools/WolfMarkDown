import assert from "node:assert/strict";
import test from "node:test";
import { compareTokens, extractTokens } from "../lib/integrity.mjs";
import { formatMarkdown } from "../lib/format.mjs";
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
