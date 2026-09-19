import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function inspectDependencies(canonicalDir) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(canonicalDir, "package.json"), "utf8"));
  } catch {
    return { ok: false, errors: ["package.json is missing."] };
  }

  const errors = [];
  for (const [name, expected] of Object.entries(manifest.dependencies ?? {})) {
    try {
      const installed = JSON.parse(await readFile(join(canonicalDir, "node_modules", name, "package.json"), "utf8"));
      if (installed.version !== expected) {
        errors.push(`${name} ${installed.version} does not match required ${expected}.`);
      }
    } catch {
      errors.push(`Dependency not installed: ${name}@${expected}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
