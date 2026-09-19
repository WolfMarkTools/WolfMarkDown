import assert from "node:assert/strict";
import test from "node:test";
import { assertFencesBalanced } from "../lib/fences.mjs";
import { formatMarkdown } from "../lib/format.mjs";
import { cells, verifyMarkdown } from "../lib/validate.mjs";
import { readFixture } from "./helpers.mjs";

test("already-clean formatted Markdown passes verification", async () => {
  const formatted = await formatMarkdown(await readFixture("already-clean.md"));
  const result = await verifyMarkdown(formatted);
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("GFM two-space hard line breaks pass verification", async () => {
  const markdown = "# Title\n\nline  \nnext\n";
  const formatted = await formatMarkdown(markdown);
  assert.equal(formatted, markdown);
  const result = await verifyMarkdown(formatted);
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("one-column GFM tables pass verification", async () => {
  const markdown = ["# Title", "", "| Title |", "| ----- |", "| row |", ""].join("\n");
  const result = await verifyMarkdown(await formatMarkdown(markdown));
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("escaped pipes inside table cells do not change the cell count", async () => {
  assert.deepEqual(cells("| a \\| b | ok |"), ["a \\| b", "ok"]);
  const markdown = ["# Title", "", "| Name | Value |", "| --- | --- |", "| a \\| b | ok |", ""].join("\n");
  const result = await verifyMarkdown(await formatMarkdown(markdown));
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

test("YAML frontmatter title plus document H1 is valid", async () => {
  const result = await verifyMarkdown(await formatMarkdown(await readFixture("frontmatter.md")));
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("two document H1s still fail verification", async () => {
  const markdown = ["# First", "", "# Second", ""].join("\n");
  const result = await verifyMarkdown(await formatMarkdown(markdown));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /MD025|top-level heading/i.test(error)));
});

test("pipe-containing list items are not treated as malformed tables", async () => {
  const markdown = ["# Title", "", "- Status | Ready", "- Owner | Platform", "- Risk | Medium", ""].join("\n");
  const result = await verifyMarkdown(await formatMarkdown(markdown));
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("numbered list items with pipes are not treated as malformed tables", async () => {
  const markdown = ["# Title", "", "1. Alpha | Beta", "2. Gamma | Delta", ""].join("\n");
  const result = await verifyMarkdown(await formatMarkdown(markdown));
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("blockquote lines with pipes are not treated as malformed tables", async () => {
  const markdown = ["# Title", "", "> Note | this is not a table", "> Also | still not", ""].join("\n");
  const result = await verifyMarkdown(await formatMarkdown(markdown));
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("unclosed fence nested in a list fails verification", async () => {
  const markdown = ["# Title", "", "- Outer", "  - Inner:", "", "    ```js", "    const y = 2;", ""].join("\n");
  const result = await verifyMarkdown(markdown);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /fence/i.test(error)));
});

test("pipes inside a list-nested fence are not table errors", async () => {
  const markdown = [
    "# Title",
    "",
    "- Outer",
    "  - Inner:",
    "",
    "    ```text",
    "    a | b | c",
    "    d | e | f",
    "    ```",
    "",
  ].join("\n");
  const result = await verifyMarkdown(await formatMarkdown(markdown));
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("document-level indented fence examples are not treated as unclosed fences", () => {
  const markdown = ["# Title", "", "Example of a fence marker:", "", "    ```js", "    const x = 1;", ""].join("\n");
  const result = assertFencesBalanced(markdown);
  assert.equal(result.ok, true, result.errors.join("\n"));
});
