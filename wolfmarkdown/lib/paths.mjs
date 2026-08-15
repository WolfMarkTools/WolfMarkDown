import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function loadJson(relativePath) {
  return JSON.parse(readFileSync(join(skillRoot, relativePath), "utf8"));
}

export function loadPrettierOptions() {
  return loadJson("config/prettier.json");
}

export function loadMarkdownlintConfig() {
  return loadJson("config/markdownlint.json");
}
