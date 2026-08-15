import assert from "node:assert/strict";
import test from "node:test";
import { formatMarkdown } from "../lib/format.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";
import { readFixture } from "./helpers.mjs";

test("already-clean formatted Markdown passes verification", async () => {
  const formatted = await formatMarkdown(await readFixture("already-clean.md"));
  const result = await verifyMarkdown(formatted);
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("broken tables fail verification", async () => {
  const result = await verifyMarkdown(await readFixture("broken-tables.md"));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /table/i.test(error)));
});

test("missing final newline fails verification", async () => {
  const result = await verifyMarkdown("# Title");
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /newline/i.test(error)));
});

test("heading skip fails verification", async () => {
  const result = await verifyMarkdown("# Title\n\n### Skipped\n");
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /heading/i.test(error)));
});

test("unclosed backtick fence fails even if a parser accepts it", async () => {
  const result = await verifyMarkdown(await readFixture("unclosed-fence.md"));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /fence/i.test(error)));
});

test("unclosed tilde fence fails verification", async () => {
  const result = await verifyMarkdown("# Title\n\n~~~\nconst value = 1;\n");
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /fence/i.test(error)));
});

test("balanced backtick and tilde fences pass the fence check", async () => {
  const markdown = ["# Title", "", "```js", "const a = 1;", "```", "", "~~~", "const b = 2;", "~~~", ""].join("\n");
  const formatted = await formatMarkdown(markdown);
  const result = await verifyMarkdown(formatted);
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("longer closing fences are valid", async () => {
  const markdown = ["# Title", "", "````md", "```", "nested fence text", "```", "````", ""].join("\n");
  const result = await verifyMarkdown(markdown);
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("fence-looking text inside a closed fence does not fail", async () => {
  const markdown = ["# Title", "", "```text", "here is ``` not a closer", "```", ""].join("\n");
  const formatted = await formatMarkdown(markdown);
  const result = await verifyMarkdown(formatted);
  assert.equal(result.ok, true, result.errors.join("\n"));
});
