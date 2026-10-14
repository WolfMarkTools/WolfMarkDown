import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";
import { skillRoot } from "../lib/paths.mjs";
import { lintEvidence, toReceipt } from "../lib/report.mjs";

const scriptPath = fileURLToPath(new URL("../scripts/verify-markdown.mjs", import.meta.url));

test("lint evidence reports version, bundled inventory and policy overrides", async () => {
  const evidence = lintEvidence();
  const pinned = JSON.parse(
    await readFile(join(skillRoot, "node_modules", "markdownlint", "package.json"), "utf8"),
  );
  assert.equal(evidence.version, pinned.version);
  assert.ok(Array.isArray(evidence.bundledRules) && evidence.bundledRules.length > 0);
  assert.ok(evidence.bundledRules.includes("MD029"));
  assert.ok(evidence.disabled.includes("MD029"));
  assert.ok(evidence.disabled.includes("MD013"));
  assert.deepEqual(evidence.configured.MD004, { style: "dash" });
  assert.match(evidence.inherited, /defaults/u);
});

test("bundled rule inventory matches the pinned package registry", async () => {
  const evidence = lintEvidence();
  const rulesModule = await import(
    pathToFileURL(join(skillRoot, "node_modules", "markdownlint", "lib", "rules.mjs")).href
  );
  const ids = rulesModule.default.map((rule) => rule.names[0]);
  assert.deepEqual([...evidence.bundledRules].sort(), [...ids].sort());
});

test("receipts carry the active lint configuration", () => {
  const receipt = toReceipt({ ok: true, checks: { parse: true } });
  assert.equal(receipt.lint.version, lintEvidence().version);
  assert.ok(receipt.lint.bundledRules.includes("MD001"));
  assert.ok(receipt.lint.disabled.includes("MD029"));
});

test("verifier text output summarises the lint configuration", () => {
  const stdout = execFileSync(
    process.execPath,
    [
      scriptPath,
      join(skillRoot, "..", "examples", "mobile-app-migration", "output.md"),
      "--integrity-from",
      join(skillRoot, "..", "examples", "mobile-app-migration", "input.md"),
    ],
    { encoding: "utf8" },
  );
  assert.match(stdout, /Lint: markdownlint \d+\.\d+\.\d+; \d+ bundled rule\(s\), \d+ disabled, \d+ configured/u);
});
