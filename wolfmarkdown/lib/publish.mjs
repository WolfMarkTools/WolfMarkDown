import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function restoreOriginal(path, originalText) {
  await writeFile(path, originalText);
}

export async function writeExistingIfValid(path, originalText, candidateText, verify) {
  const result = await verify(candidateText);
  if (!result.ok) {
    await writeFile(path, originalText);
    return { ok: false, errors: result.errors ?? ["Verification failed."] };
  }
  await writeFile(path, candidateText);
  return { ok: true };
}

export async function publishNewFile(dest, candidateText, verify, { replace = false } = {}) {
  let exists = false;
  try {
    await access(dest);
    exists = true;
  } catch {
    exists = false;
  }
  if (exists && !replace) {
    throw new Error(`Destination exists and replacement was not authorised: ${dest}`);
  }
  const result = await verify(candidateText);
  if (!result.ok) {
    return { ok: false, errors: result.errors ?? ["Verification failed."] };
  }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, candidateText);
  return { ok: true };
}
