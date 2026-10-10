import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isStdinPath, readTextSource } from "../lib/stdio.mjs";

function fakeStdin(chunks, isTTY = false) {
  return {
    isTTY,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

test("isStdinPath recognises only the dash path", () => {
  assert.equal(isStdinPath("-"), true);
  assert.equal(isStdinPath("notes.md"), false);
  assert.equal(isStdinPath("--"), false);
});

test("readTextSource refuses terminal stdin with a helpful error", async () => {
  await assert.rejects(readTextSource("-", { stdin: fakeStdin([], true) }), /no piped data/i);
});

test("readTextSource concatenates piped string and Buffer chunks", async () => {
  const text = await readTextSource("-", { stdin: fakeStdin(["# Title\n", Buffer.from("\nHello\n")]) });
  assert.equal(text, "# Title\n\nHello\n");
});

test("readTextSource reads regular files without touching stdin", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-stdio-"));
  const file = join(dir, "notes.md");
  await writeFile(file, "# Title\n");
  assert.equal(await readTextSource(file, { stdin: fakeStdin([], true) }), "# Title\n");
  await rm(dir, { recursive: true, force: true });
});
