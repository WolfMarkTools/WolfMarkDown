import assert from "node:assert/strict";
import test from "node:test";
import { compareTokens, extractTokens } from "../lib/integrity.mjs";
import { formatMarkdown } from "../lib/format.mjs";
import { readFixture } from "./helpers.mjs";

const PUBKEY = "So11111111111111111111111111111111111111112";
const SIGNATURE = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
const HEX = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

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
  const after = extractTokens("Wallet So11111111111111111111111111111111111111113");
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

test("formatting the technical fixture does not drop protected tokens", async () => {
  const original = await readFixture("technical-content.md");
  const formatted = await formatMarkdown(original);
  assert.equal(compareTokens(extractTokens(original), extractTokens(formatted)).ok, true);
});
