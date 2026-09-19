import { randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

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

export async function writeExistingIfValid(path, originalText, candidateText, verify) {
  await assertRegularFileOrMissing(path);
  const result = await verify(candidateText);
  const current = await readUtf8OrNull(path);
  if (concurrentChange(current, originalText, candidateText)) {
    return { ok: false, errors: ["Destination changed during verification; refusing to overwrite."] };
  }
  if (!result.ok) {
    if (current === candidateText) await atomicWriteFile(path, originalText);
    return { ok: false, errors: result.errors ?? ["Verification failed."] };
  }
  await atomicWriteFile(path, candidateText);
  return { ok: true };
}

export async function publishNewFile(dest, candidateText, verify, { replace = false } = {}) {
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
    const current = await readUtf8OrNull(dest);
    if (concurrentChange(current, snapshot, candidateText)) {
      return { ok: false, errors: ["Destination changed during verification; refusing to overwrite."] };
    }
    await atomicWriteFile(dest, candidateText);
    return { ok: true };
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
