import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { skillRoot } from "./helpers.mjs";

test("SKILL.md makes the pre-format semantic gate visible", async () => {
  const skill = await readFile(`${skillRoot}/SKILL.md`, "utf8");
  assert.match(skill, /Before formatting, inspect whether the source contains flattened semantic structure/u);
  assert.match(skill, /Do not let Prettier become the first structural transformation/u);
  assert.match(skill, /tables, headings, lists, or relationships/u);
});
