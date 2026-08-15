import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inferOutputPath, kebabFileName } from "../lib/output-path.mjs";
import { publishNewFile, restoreOriginal, writeExistingIfValid } from "../lib/publish.mjs";

test("failed existing-file update restores the exact original", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-"));
  const target = join(dir, "notes.md");
  const original = "# Original\n\nKeep this.\n";
  await writeFile(target, original);
  const outcome = await writeExistingIfValid(target, original, "# Broken\n\n```js\nconst x = 1;\n", async () => ({
    ok: false,
    errors: ["forced failure"],
  }));
  assert.equal(outcome.ok, false);
  assert.equal(await readFile(target, "utf8"), original);
  await rm(dir, { recursive: true, force: true });
});

test("failed new compose does not publish the destination", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-compose-"));
  const dest = join(dir, "new.md");
  const outcome = await publishNewFile(dest, "# Broken\n\n```js\nconst x = 1;\n", async () => ({
    ok: false,
    errors: ["forced failure"],
  }));
  assert.equal(outcome.ok, false);
  await assert.rejects(readFile(dest, "utf8"));
  await rm(dir, { recursive: true, force: true });
});

test("existing unrelated file is not overwritten without authorisation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-collision-"));
  const dest = join(dir, "existing.md");
  await writeFile(dest, "# Unrelated\n");
  await assert.rejects(publishNewFile(dest, "# Replacement\n", async (text) => ({ ok: true, text })), /exists|authoris|replace/i);
  assert.equal(await readFile(dest, "utf8"), "# Unrelated\n");
  await rm(dir, { recursive: true, force: true });
});

test("restoreOriginal writes the snapshot bytes back", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-restore-"));
  const target = join(dir, "doc.md");
  await writeFile(target, "changed\n");
  await restoreOriginal(target, "original\n");
  assert.equal(await readFile(target, "utf8"), "original\n");
  await rm(dir, { recursive: true, force: true });
});

test("inferOutputPath honours an explicit path", () => {
  assert.equal(inferOutputPath({ cwd: "/repo", explicitPath: "docs/verdict.md" }), join("/repo", "docs/verdict.md"));
});

test("inferOutputPath uses docs when that directory exists and otherwise stays in cwd", () => {
  assert.equal(
    inferOutputPath({ cwd: "/repo", title: "Solana Wallet Research", hasDocsDir: true }),
    join("/repo", "docs", "solana-wallet-research.md"),
  );
  assert.equal(
    inferOutputPath({ cwd: "/repo", title: "Architecture Verdict", hasDocsDir: false }),
    join("/repo", "architecture-verdict.md"),
  );
});

test("kebabFileName does not invent nested directories", () => {
  assert.equal(kebabFileName("Solana Paid-Action Architecture Research"), "solana-paid-action-architecture-research.md");
  assert.doesNotMatch(kebabFileName("A / B"), /\//);
});
