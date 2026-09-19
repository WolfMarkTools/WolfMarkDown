import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inferOutputPath, kebabFileName } from "../lib/output-path.mjs";
import { publishNewFile, replaceInto, restoreOriginal, writeExistingIfValid } from "../lib/publish.mjs";

test("failed existing-file update restores the exact original", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-"));
  const target = join(dir, "notes.md");
  const original = "# Original\n\nKeep this.\n";
  const candidate = "# Broken\n\n```js\nconst x = 1;\n";
  await writeFile(target, original);
  const outcome = await writeExistingIfValid(target, original, candidate, async () => {
    await writeFile(target, candidate);
    return { ok: false, errors: ["forced failure"] };
  });
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

test("exclusive create writes a new destination", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-exclusive-"));
  const dest = join(dir, "new.md");
  const outcome = await publishNewFile(dest, "# New\n", async () => ({ ok: true }));
  assert.equal(outcome.ok, true);
  assert.equal(await readFile(dest, "utf8"), "# New\n");
  await rm(dir, { recursive: true, force: true });
});

test("replace authorises overwrite of an existing destination", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-replace-"));
  const dest = join(dir, "existing.md");
  await writeFile(dest, "# Unrelated\n");
  const outcome = await publishNewFile(dest, "# Replacement\n", async () => ({ ok: true }), { replace: true });
  assert.equal(outcome.ok, true);
  assert.equal(await readFile(dest, "utf8"), "# Replacement\n");
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

test("refuses to write through a symlink ancestor", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-ancestor-"));
  const realDir = join(dir, "real");
  const linkedDir = join(dir, "linked");
  await mkdir(realDir);
  await symlink(realDir, linkedDir);
  const dest = join(linkedDir, "notes.md");
  await assert.rejects(
    publishNewFile(dest, "# Replacement\n", async () => ({ ok: true }), { replace: true }),
    /symlink/i,
  );
  await rm(dir, { recursive: true, force: true });
});

test("refuses to publish through a symlink", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-symlink-"));
  const real = join(dir, "real.md");
  const dest = join(dir, "dest.md");
  await writeFile(real, "# Real\n");
  await symlink(real, dest);
  await assert.rejects(
    publishNewFile(dest, "# Replacement\n", async () => ({ ok: true }), { replace: true }),
    /symlink/i,
  );
  assert.equal(await readFile(real, "utf8"), "# Real\n");
  await rm(dir, { recursive: true, force: true });
});

test("refuses to update a symlink destination", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-symlink-update-"));
  const real = join(dir, "real.md");
  const dest = join(dir, "dest.md");
  await writeFile(real, "# Original\n");
  await symlink(real, dest);
  await assert.rejects(writeExistingIfValid(dest, "# Original\n", "# Replacement\n", async () => ({ ok: true })), /symlink/i);
  assert.equal(await readFile(real, "utf8"), "# Original\n");
  await rm(dir, { recursive: true, force: true });
});

test("refuses to overwrite when the destination changed during verification", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-concurrent-"));
  const target = join(dir, "notes.md");
  const original = "# Original\n\nKeep this.\n";
  await writeFile(target, original);
  const outcome = await writeExistingIfValid(target, original, "# Replacement\n", async () => {
    await writeFile(target, "# Concurrent edit\n");
    return { ok: true };
  });
  assert.equal(outcome.ok, false);
  assert.ok(outcome.errors.some((error) => /changed during verification/i.test(error)));
  assert.equal(await readFile(target, "utf8"), "# Concurrent edit\n");
  await rm(dir, { recursive: true, force: true });
});

test("failed existing-file update does not restore over a concurrent edit", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-concurrent-fail-"));
  const target = join(dir, "notes.md");
  const original = "# Original\n\nKeep this.\n";
  await writeFile(target, original);
  const outcome = await writeExistingIfValid(target, original, "# Broken\n", async () => {
    await writeFile(target, "# Concurrent edit\n");
    return { ok: false, errors: ["forced failure"] };
  });
  assert.equal(outcome.ok, false);
  assert.ok(outcome.errors.some((error) => /changed during verification/i.test(error)));
  assert.equal(await readFile(target, "utf8"), "# Concurrent edit\n");
  await rm(dir, { recursive: true, force: true });
});

test("replace authorisation refuses to overwrite a concurrent edit", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-replace-concurrent-"));
  const dest = join(dir, "existing.md");
  await writeFile(dest, "# Unrelated\n");
  const outcome = await publishNewFile(dest, "# Replacement\n", async () => {
    await writeFile(dest, "# Concurrent edit\n");
    return { ok: true };
  }, { replace: true });
  assert.equal(outcome.ok, false);
  assert.ok(outcome.errors.some((error) => /changed during verification/i.test(error)));
  assert.equal(await readFile(dest, "utf8"), "# Concurrent edit\n");
  await rm(dir, { recursive: true, force: true });
});

test("Windows replace restores the original if the retry rename fails", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-win-replace-"));
  const dest = join(dir, "notes.md");
  const tmp = join(dir, "notes.tmp");
  await writeFile(dest, "original\n");
  await writeFile(tmp, "new\n");
  let attempts = 0;
  await assert.rejects(
    replaceInto(tmp, dest, {
      platform: "win32",
      renameFn: async (from, to) => {
        attempts += 1;
        if (attempts === 1 || attempts === 3) {
          const error = new Error("EPERM");
          error.code = "EPERM";
          throw error;
        }
        return rename(from, to);
      },
    }),
  );
  assert.equal(await readFile(dest, "utf8"), "original\n");
  assert.equal(await readFile(tmp, "utf8"), "new\n");
  await rm(dir, { recursive: true, force: true });
});

test("Windows replace retries through a backup instead of deleting the destination", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-win-retry-"));
  const dest = join(dir, "notes.md");
  const tmp = join(dir, "notes.tmp");
  await writeFile(dest, "original\n");
  await writeFile(tmp, "new\n");
  let attempts = 0;
  await replaceInto(tmp, dest, {
    platform: "win32",
    renameFn: async (from, to) => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error("EPERM");
        error.code = "EPERM";
        throw error;
      }
      return rename(from, to);
    },
  });
  assert.equal(await readFile(dest, "utf8"), "new\n");
  await assert.rejects(readFile(tmp, "utf8"));
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
