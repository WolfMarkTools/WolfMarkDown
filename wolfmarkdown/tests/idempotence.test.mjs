import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import test from "node:test";
import { formatMarkdown } from "../lib/format.mjs";
import { fixtureInput, readFixture } from "./helpers.mjs";

test("format(format(x)) equals format(x) for every input fixture", async () => {
  const names = (await readdir(fixtureInput(""))).filter((name) => name.endsWith(".md"));
  assert.ok(names.includes("already-clean.md"));
  for (const name of names) {
    const input = await readFixture(name);
    const once = await formatMarkdown(input);
    const twice = await formatMarkdown(once);
    assert.equal(twice, once, name);
  }
});
