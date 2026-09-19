import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { documentScaffold, SCAFFOLD_NOTE } from "../lib/scaffold.mjs";
import { skillRoot } from "./helpers.mjs";

test("documentScaffold inventories headings, fences, and pipe runs without rewriting", () => {
  const scaffold = documentScaffold(
    [
      "# Title",
      "",
      "- Status | Ready",
      "",
      "```js",
      "const x = 1;",
      "```",
      "",
    ].join("\n"),
  );
  assert.equal(scaffold.headings[0]?.text, "Title");
  assert.equal(scaffold.fences.length, 1);
  assert.equal(scaffold.pipeRuns.length, 1);
  assert.equal(scaffold.pipeRuns[0].listLike, true);
  assert.equal(scaffold.gfmTables, 0);
  assert.equal(scaffold.note, SCAFFOLD_NOTE);
  assert.equal(scaffold.hash.length, 64);
});

test("scaffold-markdown.mjs --json reads standard input", () => {
  const ran = spawnSync(
    process.execPath,
    [join(skillRoot, "scripts", "scaffold-markdown.mjs"), "-", "--json"],
    { encoding: "utf8", input: "# Heading\n\nBody.\n" },
  );
  assert.equal(ran.status, 0, ran.stderr);
  const body = JSON.parse(ran.stdout);
  assert.equal(body.path, "-");
  assert.equal(body.headings[0]?.text, "Heading");
  assert.match(body.note, /does not decide semantic structure/i);
});
