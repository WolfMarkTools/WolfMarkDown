import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git"]);

async function lstatOrNull(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function collectMarkdownTargets(paths) {
  const files = [];
  for (const path of paths) {
    const info = await lstatOrNull(path);
    if (!info || info.isSymbolicLink()) {
      throw new Error(`Not a Markdown file or directory: ${path}`);
    }
    if (info.isDirectory()) await walkDir(path, files);
    else if (info.isFile()) files.push(path);
    else throw new Error(`Not a Markdown file or directory: ${path}`);
  }
  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

async function walkDir(dir, files) {
  const dirInfo = await lstatOrNull(dir);
  if (!dirInfo || dirInfo.isSymbolicLink() || !dirInfo.isDirectory()) return;
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const path = join(dir, entry.name);
    const info = await lstatOrNull(path);
    if (!info || info.isSymbolicLink()) continue;
    if (info.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkDir(path, files);
      continue;
    }
    if (info.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
}

export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length || 1) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
