import { randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

async function lstatOrNull(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function assertRegularFileOrMissing(path, label = "Destination") {
  const info = await lstatOrNull(path);
  if (!info) return;
  if (info.isSymbolicLink()) {
    throw new Error(`${label} is a symlink and will not be followed: ${path}`);
  }
  if (info.isDirectory()) {
    throw new Error(`${label} is a directory: ${path}`);
  }
}

function tempSibling(path) {
  return join(dirname(path), `.wolfmarkdown-${randomBytes(8).toString("hex")}.tmp`);
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
    try {
      await rename(tmp, path);
    } catch (error) {
      if (process.platform === "win32") {
        await unlink(path).catch(() => {});
        await rename(tmp, path);
      } else {
        throw error;
      }
    }
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
  if (!result.ok) {
    await atomicWriteFile(path, originalText);
    return { ok: false, errors: result.errors ?? ["Verification failed."] };
  }
  let current;
  try {
    current = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    current = null;
  }
  if (current != null && current !== originalText && current !== candidateText) {
    return { ok: false, errors: ["Destination changed during verification; refusing to overwrite."] };
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
  const result = await verify(candidateText);
  if (!result.ok) {
    return { ok: false, errors: result.errors ?? ["Verification failed."] };
  }
  await mkdir(dirname(dest), { recursive: true });
  if (replace) {
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
