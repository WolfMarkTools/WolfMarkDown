import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { formatMarkdown } from "../lib/format.mjs";
import { toPublicResult } from "../lib/report.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { readFixture, skillRoot } from "./helpers.mjs";

test("toPublicResult uses pass/fail strings and keeps errors", async () => {
  const result = await verifyMarkdown("# Title");
  const json = toPublicResult(result);
  assert.equal(json.ok, false);
  assert.equal(json.checks.whitespace, "fail");
  assert.equal(json.checks.integrity, "skip");
  assert.equal(typeof json.checks.parse, "string");
  assert.ok(Array.isArray(json.errors));
  assert.ok(json.errors.length > 0);
});

test("verify-markdown.mjs --json prints machine-readable output", async () => {
  const formatted = await formatMarkdown(await readFixture("already-clean.md"));
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-json-"));
  const file = join(dir, "clean.md");
  await writeFile(file, formatted);
  const ran = spawnSync(process.execPath, [join(skillRoot, "scripts", "verify-markdown.mjs"), file, "--json"], {
    encoding: "utf8",
  });
  await rm(dir, { recursive: true, force: true });
  assert.equal(ran.status, 0, ran.stderr);
  const body = JSON.parse(ran.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.checks.prettier, "pass");
  assert.equal(body.checks.integrity, "skip");
  assert.deepEqual(body.errors, []);
});
