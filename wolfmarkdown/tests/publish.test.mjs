import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rename, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inferOutputPath, kebabFileName } from "../lib/output-path.mjs";
import { lockFileFor, publishNewFile, replaceInto, restoreOriginal, withDestinationLock, writeExistingIfValid } from "../lib/publish.mjs";
import { skillRoot } from "./helpers.mjs";

const HOLDER_SCRIPT = [
  "const lockfile = (await import('proper-lockfile')).default;",
  "await lockfile.lock(process.argv[1], { realpath: false, lockfilePath: process.argv[2], retries: 0 });",
  "setInterval(() => {}, 1000);",
].join("\n");

async function waitFor(condition, timeoutMs = 5000) {
  const started = Date.now();
  for (;;) {
    if (await condition()) return;
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for test setup.");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function lockExists(path) {
  return stat(path).then(
    () => true,
    () => false,
  );
}

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

test("concurrent same-content publishes serialise without conflict", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-race-"));
  const target = join(dir, "notes.md");
  const original = "# Original\n\nKeep this.\n";
  const candidate = "# Replacement\n\nNew content.\n";
  await writeFile(target, original);
  const verify = async () => {
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 50));
    return { ok: true };
  };
  const [first, second] = await Promise.all([
    writeExistingIfValid(target, original, candidate, verify),
    writeExistingIfValid(target, original, candidate, verify),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(await readFile(target, "utf8"), candidate);
  await assert.rejects(stat(await lockFileFor(target)));
  await rm(dir, { recursive: true, force: true });
});

test("a second writer sees a clear conflict after the first writer wins", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-conflict-"));
  const target = join(dir, "notes.md");
  const original = "# Original\n\nKeep this.\n";
  await writeFile(target, original);
  const first = await writeExistingIfValid(target, original, "# First wins\n", async () => ({ ok: true }));
  assert.equal(first.ok, true);
  const second = await writeExistingIfValid(target, original, "# Second loses\n", async () => ({ ok: true }));
  assert.equal(second.ok, false);
  assert.ok(second.errors.some((error) => /changed during verification/i.test(error)));
  assert.equal(await readFile(target, "utf8"), "# First wins\n");
  await rm(dir, { recursive: true, force: true });
});

test("a lock abandoned by a killed process is recovered", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-stale-"));
  const target = join(dir, "notes.md");
  await writeFile(target, "# Original\n");
  const lockPath = await lockFileFor(target);
  const holder = spawn(process.execPath, ["--input-type=module", "-e", HOLDER_SCRIPT, target, lockPath], {
    cwd: skillRoot,
    stdio: "ignore",
  });
  try {
    await waitFor(() => lockExists(lockPath));
    holder.kill("SIGKILL");
    await once(holder, "exit");
    await utimes(lockPath, new Date(0), new Date(0));
    const outcome = await writeExistingIfValid(target, "# Original\n", "# Replacement\n", async () => ({ ok: true }));
    assert.equal(outcome.ok, true);
    assert.equal(await readFile(target, "utf8"), "# Replacement\n");
    await assert.rejects(stat(lockPath));
  } finally {
    holder.kill();
  }
  await rm(dir, { recursive: true, force: true });
});

test("a live owner's lock is never reclaimed by age", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-live-"));
  const target = join(dir, "notes.md");
  await writeFile(target, "# Original\n");
  await withDestinationLock(target, async () => {
    await assert.rejects(
      writeExistingIfValid(target, "# Original\n", "# Replacement\n", async () => ({ ok: true }), { timeoutMs: 300 }),
      /locked by another/i,
    );
  });
  assert.equal(await readFile(target, "utf8"), "# Original\n");
  await rm(dir, { recursive: true, force: true });
});

test("different path spellings of one destination share a lock file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-canon-"));
  const realDir = join(dir, "real");
  await mkdir(realDir);
  await symlink(realDir, join(dir, "linked"));
  const direct = await lockFileFor(join(realDir, "notes.md"));
  assert.equal(direct, await lockFileFor(join(dir, "linked", "notes.md")));
  assert.equal(direct, await lockFileFor(join(realDir, ".", "notes.md")));
  await rm(dir, { recursive: true, force: true });
});

test("lock ownership check passes while the lock is held", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-owned-"));
  const target = join(dir, "notes.md");
  await writeFile(target, "# Original\n");
  await withDestinationLock(target, async ({ checkOwnership }) => {
    checkOwnership();
  });
  await rm(dir, { recursive: true, force: true });
});

test("concurrent publishers under contention leave exactly one winner", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-stress-"));
  const target = join(dir, "notes.md");
  const original = "# Original\n\nKeep this.\n";
  await writeFile(target, original);
  const verify = async () => {
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 20));
    return { ok: true };
  };
  const outcomes = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      writeExistingIfValid(target, original, `# Candidate ${index}\n`, verify),
    ),
  );
  const winners = outcomes.filter((outcome) => outcome.ok);
  assert.equal(winners.length, 1);
  assert.ok(outcomes.filter((outcome) => !outcome.ok).every((outcome) => outcome.errors.some((error) => /changed during verification/i.test(error))));
  assert.match(await readFile(target, "utf8"), /^# Candidate \d\n$/);
  await assert.rejects(stat(await lockFileFor(target)));
  await rm(dir, { recursive: true, force: true });
});

test("a live foreign lock fails with a conflict instead of waiting forever", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-locked-"));
  const target = join(dir, "notes.md");
  await writeFile(target, "# Original\n");
  const lockPath = await lockFileFor(target);
  const holder = spawn(process.execPath, ["--input-type=module", "-e", HOLDER_SCRIPT, target, lockPath], {
    cwd: skillRoot,
    stdio: "ignore",
  });
  try {
    await waitFor(() => lockExists(lockPath));
    await assert.rejects(
      writeExistingIfValid(target, "# Original\n", "# Replacement\n", async () => ({ ok: true }), { timeoutMs: 300 }),
      /locked by another/i,
    );
    assert.equal(await readFile(target, "utf8"), "# Original\n");
  } finally {
    holder.kill();
  }
  await rm(dir, { recursive: true, force: true });
});

test("the destination lock is released when verification fails", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-publish-lockfail-"));
  const target = join(dir, "notes.md");
  await writeFile(target, "# Original\n");
  const outcome = await writeExistingIfValid(target, "# Original\n", "# Broken\n", async () => ({
    ok: false,
    errors: ["forced failure"],
  }));
  assert.equal(outcome.ok, false);
  await assert.rejects(stat(await lockFileFor(target)));
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
