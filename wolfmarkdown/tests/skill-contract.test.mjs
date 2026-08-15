import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { skillRoot } from "./helpers.mjs";

const triggers = [
  "WolfMarkDown",
  "/wolfmarkdown",
  "/wolfmarkdown setup",
  "Markdown cleanup",
  "Markdown formatting",
  "Markdown repair",
  "malformed Markdown",
  "badly formatted research",
  "AI-generated research cleanup",
  "copied agent conversation cleanup",
  "documentation formatting",
  "malformed tables",
  ".md cleanup",
  "Markdown lint failures",
  "export as Markdown",
  "export as a Markdown file",
  "present as Markdown",
  "write as Markdown",
  "write a Markdown file",
  "create a Markdown file",
  "create a .md",
  "save this as Markdown",
  "save this as .md",
  "format this Markdown",
  "clean this Markdown",
  "repair this Markdown",
  "validate this Markdown",
  "check this Markdown",
  "install WolfMarkDown",
  "set up WolfMarkDown",
  "WolfMarkDown doctor",
];

test("SKILL.md satisfies the WolfMarkDown contract", async () => {
  const text = await readFile(join(skillRoot, "SKILL.md"), "utf8");
  assert.match(text, /^---\nname: wolfmarkdown\n/u);
  assert.match(text, /description:/);
  for (const trigger of triggers) {
    if (trigger === "/wolfmarkdown") {
      assert.match(text, /(?:^|[\s`])\/wolfmarkdown(?!\s+(?:setup|install|doctor|verify)\b)/u);
      continue;
    }
    assert.ok(text.includes(trigger), `missing trigger ${trigger}`);
  }
  assert.match(text, /snapshot/i);
  assert.match(text, /--integrity-from/);
  assert.match(text, /Do not refresh the snapshot from the edited file/);
  assert.match(text, /Delete the temporary snapshot/);
  assert.match(text, /install\.mjs/);
  assert.match(text, /format-markdown\.mjs/);
  assert.match(text, /verify-markdown\.mjs/);
  assert.match(text, /Slash command/);
  assert.match(text, /\/wolfmarkdown setup/);
  assert.match(text, /\/wolfmarkdown doctor/);
  assert.match(text, /## Intent/);
  assert.match(text, /\*\*Setup\*\*/);
  assert.match(text, /\*\*Doctor\*\*/);
  assert.match(text, /\*\*Verify\*\*/);
  assert.match(text, /\*\*Clean\*\*/);
  assert.match(text, /\*\*Compose\*\*/);
  assert.match(text, /not sufficient to trigger WolfMarkDown Compose/);
  assert.match(text, /doctor\.mjs/);
  assert.match(text, /Operation: Setup/);
  assert.match(text, /Operation: Doctor/);
  assert.match(text, /Operation: Verify/);
  assert.match(text, /Operation: Clean/);
  assert.match(text, /Operation: Compose/);
  assert.match(text, /standalone/);
  assert.match(text, /Do not invent/);
  assert.match(text, /restore/);
  assert.match(text, /Compose workflow/);
  assert.match(text, /Do not ask them to copy shell commands/);
  assert.match(text, /references\/conversation-sanitisation\.md/);
  assert.match(text, /references\/wolfmark-markdown-style\.md/);
  assert.match(text, /references\/preservation\.md/);
  assert.match(text, /Result: PASS\|FAIL/);
  assert.doesNotMatch(text, /--mode/);
  assert.doesNotMatch(text, /remark-stringify/);
  assert.doesNotMatch(text, /markdown-polisher/);
  assert.doesNotMatch(text, /[\u2705\u274C\u26A0\uD83D\uDE80]/u);
});
