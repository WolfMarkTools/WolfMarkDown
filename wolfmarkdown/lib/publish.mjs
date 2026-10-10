import { createHash, randomBytes } from "node:crypto";
import lockfile from "proper-lockfile";
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, basename, join, resolve } from "node:path";

async function lstatOrNull(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function ancestorChain(path) {
  const chain = [];
  let current = resolve(path);
  while (true) {
    chain.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return chain;
}

async function benignSymlinkAncestors() {
  const allowed = new Set();
  for (const base of [process.cwd(), tmpdir()]) {
    const starts = [resolve(base)];
    try {
      starts.push(await realpath(base));
    } catch {
      // The base may not exist yet.
    }
    for (const start of starts) {
      for (const node of ancestorChain(start)) allowed.add(node);
    }
  }
  return allowed;
}

export async function assertRegularFileOrMissing(path, label = "Destination") {
  const absolute = resolve(path);
  const benign = await benignSymlinkAncestors();
  let current = absolute;
  let first = true;
  while (true) {
    const info = await lstatOrNull(current);
    if (info?.isSymbolicLink() && (first || !benign.has(current))) {
      throw new Error(
        first
          ? `${label} is a symlink and will not be followed: ${path}`
          : `${label} path traverses a symlink: ${current}`,
      );
    }
    if (first && info && !info.isSymbolicLink() && !info.isFile()) {
      throw new Error(
        info.isDirectory() ? `${label} is a directory: ${path}` : `${label} is not a regular file: ${path}`,
      );
    }
    const parent = dirname(current);
    if (parent === current) break;
    first = false;
    current = parent;
  }
}

const WINDOWS_REPLACE_CODES = new Set(["EPERM", "EEXIST", "EACCES", "EBUSY"]);

function tempSibling(path) {
  return join(dirname(path), `.wolfmarkdown-${randomBytes(8).toString("hex")}.tmp`);
}

export async function resolvedFilePath(path) {
  const absolute = resolve(path);
  try {
    return await realpath(absolute);
  } catch (error) {
    if (error?.code === "ENOENT") return absolute;
    throw error;
  }
}

export async function assertDistinctPath(output, sources, message) {
  const outputResolved = await resolvedFilePath(output);
  for (const source of sources) {
    if (!source || source === "-") continue;
    if ((await resolvedFilePath(source)) === outputResolved) throw new Error(message);
  }
}

async function readUtf8OrNull(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return null;
  }
}

function concurrentChange(current, originalText, candidateText) {
  return current != null && current !== originalText && current !== candidateText;
}

const LOCK_STALE_MS = 10_000;

// Locks coordinate cooperating WolfMarkDown processes running as the same OS
// user. Each user gets a private lock namespace so one user's directory can
// never block another user's publishing. Locking is advisory: writers that do
// not use these helpers are still caught by the concurrent-change check, but
// their writes are not serialised.
function lockScopeDir() {
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  return uid == null ? join(tmpdir(), "wolfmarkdown-locks") : join(tmpdir(), `wolfmarkdown-locks-uid${uid}`);
}

async function canonicalDest(dest) {
  try {
    return await realpath(dest);
  } catch {
    try {
      return join(await realpath(dirname(dest)), basename(dest));
    } catch {
      return resolve(dest);
    }
  }
}

export async function lockFileFor(dest) {
  const key = createHash("sha256").update(await canonicalDest(dest)).digest("hex");
  return join(lockScopeDir(), `${key}.lock`);
}

function lockConflict(dest) {
  return new Error(`Destination is locked by another WolfMarkDown operation: ${dest}`);
}

// Exclusive publishing uses proper-lockfile (atomic directory creation, live
// mtime refresh while held, stale takeover, compromise detection) over a
// canonical per-destination key. A live lock is never reclaimed by age: only
// a lock whose owner is gone, or whose mtime has gone stale, can be taken
// over. Waiting is bounded by timeoutMs.
export async function acquireDestinationLock(dest, { timeoutMs = 10_000 } = {}) {
  const canonical = await canonicalDest(dest);
  const lockFile = await lockFileFor(dest);
  await mkdir(dirname(lockFile), { recursive: true });
  let compromised = null;
  let release;
  try {
    release = await lockfile.lock(canonical, {
      realpath: false,
      lockfilePath: lockFile,
      stale: LOCK_STALE_MS,
      retries:
        timeoutMs <= 0
          ? 0
          : { retries: Math.max(1, Math.ceil(timeoutMs / 50)), minTimeout: 25, maxTimeout: 50 },
      onCompromised: (error) => {
        compromised = error;
      },
    });
  } catch (error) {
    if (error?.code === "ELOCKED") throw lockConflict(dest);
    throw error;
  }
  return {
    lockFile,
    checkOwnership: () => {
      if (compromised) throw new Error(`Destination lock was compromised for ${dest}; refusing to write.`);
    },
    release: async () => {
      await release().catch(() => {});
    },
  };
}

export async function withDestinationLock(dest, fn, options = {}) {
  const { lockFile, checkOwnership, release } = await acquireDestinationLock(dest, options);
  try {
    return await fn({ lockFile, checkOwnership });
  } finally {
    await release();
  }
}

export async function replaceInto(tmp, path, { platform = process.platform, renameFn = rename, unlinkFn = unlink } = {}) {
  try {
    await renameFn(tmp, path);
    return;
  } catch (error) {
    if (platform !== "win32" || !WINDOWS_REPLACE_CODES.has(error?.code)) throw error;
  }
  const existing = await lstatOrNull(path);
  if (!existing) {
    await renameFn(tmp, path);
    return;
  }
  const backup = `${path}.${randomBytes(8).toString("hex")}.bak`;
  await renameFn(path, backup);
  try {
    await renameFn(tmp, path);
  } catch (error) {
    await renameFn(backup, path);
    throw error;
  }
  await unlinkFn(backup).catch(() => {});
}

export async function atomicWriteFile(path, text) {
  await assertRegularFileOrMissing(path);
  await mkdir(dirname(path), { recursive: true });
  const tmp = tempSibling(path);
  try {
    const handle = await open(tmp, "wx");
    try {
      await handle.writeFile(text);
    } finally {
      await handle.close();
    }
    await replaceInto(tmp, path);
  } catch (error) {
    await unlink(tmp).catch(() => {});
    throw error;
  }
}

export async function restoreOriginal(path, originalText) {
  await atomicWriteFile(path, originalText);
}

export async function writeExistingIfValid(path, originalText, candidateText, verify, options = {}) {
  await assertRegularFileOrMissing(path);
  const result = await verify(candidateText);
  return withDestinationLock(
    path,
    async ({ checkOwnership }) => {
      await assertRegularFileOrMissing(path);
      const current = await readUtf8OrNull(path);
      if (concurrentChange(current, originalText, candidateText)) {
        return { ok: false, errors: ["Destination changed during verification; refusing to overwrite."] };
      }
      if (!result.ok) {
        if (current === candidateText) {
          checkOwnership();
          await atomicWriteFile(path, originalText);
        }
        return { ok: false, errors: result.errors ?? ["Verification failed."] };
      }
      checkOwnership();
      await atomicWriteFile(path, candidateText);
      return { ok: true };
    },
    options,
  );
}

export async function publishNewFile(dest, candidateText, verify, { replace = false, lockTimeoutMs } = {}) {
  await assertRegularFileOrMissing(dest);
  const existing = await lstatOrNull(dest);
  if (existing && !replace) {
    throw new Error(`Destination exists and replacement was not authorised: ${dest}`);
  }
  const snapshot = existing ? await readFile(dest, "utf8") : null;
  const result = await verify(candidateText);
  if (!result.ok) {
    return { ok: false, errors: result.errors ?? ["Verification failed."] };
  }
  await mkdir(dirname(dest), { recursive: true });
  if (replace) {
    return withDestinationLock(
      dest,
      async ({ checkOwnership }) => {
        await assertRegularFileOrMissing(dest);
        const current = await readUtf8OrNull(dest);
        if (concurrentChange(current, snapshot, candidateText)) {
          return { ok: false, errors: ["Destination changed during verification; refusing to overwrite."] };
        }
        checkOwnership();
        await atomicWriteFile(dest, candidateText);
        return { ok: true };
      },
      lockTimeoutMs == null ? {} : { timeoutMs: lockTimeoutMs },
    );
  }
  try {
    await assertRegularFileOrMissing(dest);
    const handle = await open(dest, "wx");
    try {
      await handle.writeFile(candidateText);
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`Destination exists and replacement was not authorised: ${dest}`);
    }
    throw error;
  }
  return { ok: true };
}
