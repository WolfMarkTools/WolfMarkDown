import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const fixtureInput = (name) => join(skillRoot, "tests", "fixtures", "input", name);

export async function readFixture(name) {
  return readFile(fixtureInput(name), "utf8");
}
