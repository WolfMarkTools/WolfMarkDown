import { createHash, randomBytes } from "node:crypto";
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

const LOCK_STALE_MS = 30_000;
const LOCK_MAX_HOLD_MS = 10 * 60_000;

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
  return join(tmpdir(), "wolfmarkdown-locks", `${key}.lock`);
}

function pidAlive(pid) {
  if (!Number.isInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function lockIsStale(raw) {
  if (!raw) return true;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return true;
  }
  if (!data || typeof data.created !== "number") return true;
  if (Number.isInteger(data.pid) && pidAlive(data.pid)) {
    return Date.now() - data.created > LOCK_MAX_HOLD_MS;
  }
  if (Number.isInteger(data.pid)) return true;
  return Date.now() - data.created > LOCK_STALE_MS;
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function lockConflict(dest) {
  return new Error(`Destination is locked by another WolfMarkDown operation: ${dest}`);
}

export async function acquireDestinationLock(dest, { timeoutMs = 10_000 } = {}) {
  const lockFile = await lockFileFor(dest);
  await mkdir(dirname(lockFile), { recursive: true });
  const payload = JSON.stringify({ pid: process.pid, created: Date.now(), nonce: randomBytes(8).toString("hex") });
  const started = Date.now();
  for (;;) {
    try {
      const handle = await open(lockFile, "wx");
      try {
        await handle.writeFile(payload);
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (Date.now() - started >= timeoutMs) throw lockConflict(dest);
      if (!lockIsStale(await readUtf8OrNull(lockFile))) {
        await sleep(25);
        continue;
      }
      // Possibly stale: confirm it is unchanged before removing, so a fresh
      // lock acquired concurrently is never deleted.
      const first = await readUtf8OrNull(lockFile);
      if (!lockIsStale(first) || first !== (await readUtf8OrNull(lockFile))) continue;
      await unlink(lockFile).catch(() => {});
      continue;
    }
    // Confirm the lock on disk is the one just created: a concurrent stale
    // takeover may have removed it between creation and this read.
    if ((await readUtf8OrNull(lockFile)) === payload) return { lockFile, payload };
    if (Date.now() - started >= timeoutMs) throw lockConflict(dest);
    await sleep(25);
  }
}

export async function assertLockOwned(lockFile, payload) {
  if ((await readUtf8OrNull(lockFile)) !== payload) {
    throw new Error(`Lost the destination lock for ${lockFile}; refusing to write.`);
  }
}

export async function withDestinationLock(dest, fn, options = {}) {
  const { lockFile, payload } = await acquireDestinationLock(dest, options);
  try {
    return await fn({ lockFile, payload });
  } finally {
    if ((await readUtf8OrNull(lockFile)) === payload) await unlink(lockFile).catch(() => {});
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
    async ({ lockFile, payload }) => {
      await assertRegularFileOrMissing(path);
      const current = await readUtf8OrNull(path);
      if (concurrentChange(current, originalText, candidateText)) {
        return { ok: false, errors: ["Destination changed during verification; refusing to overwrite."] };
      }
      if (!result.ok) {
        if (current === candidateText) {
          await assertLockOwned(lockFile, payload);
          await atomicWriteFile(path, originalText);
        }
        return { ok: false, errors: result.errors ?? ["Verification failed."] };
      }
      await assertLockOwned(lockFile, payload);
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
      async ({ lockFile, payload }) => {
        await assertRegularFileOrMissing(dest);
        const current = await readUtf8OrNull(dest);
        if (concurrentChange(current, snapshot, candidateText)) {
          return { ok: false, errors: ["Destination changed during verification; refusing to overwrite."] };
        }
        await assertLockOwned(lockFile, payload);
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
