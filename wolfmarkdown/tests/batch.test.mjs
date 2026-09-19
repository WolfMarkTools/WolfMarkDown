import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectMarkdownTargets } from "../lib/batch.mjs";

test("collectMarkdownTargets skips symlinks while walking a directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-batch-"));
  const nested = join(dir, "nested");
  await mkdir(nested);
  const real = join(nested, "real.md");
  await writeFile(real, "# Title\n\nKeep this.\n");
  await writeFile(join(dir, "keep.md"), "# Title\n\nKeep this.\n");
  await symlink(real, join(dir, "alias.md"));
  await symlink(nested, join(dir, "linked-dir"));
  const files = await collectMarkdownTargets([dir]);
  assert.deepEqual(files, [join(dir, "keep.md"), real].sort((left, right) => left.localeCompare(right)));
  await rm(dir, { recursive: true, force: true });
});

test("collectMarkdownTargets refuses a top-level symlink", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wolfmarkdown-batch-top-"));
  const real = join(dir, "real.md");
  const link = join(dir, "link.md");
  await writeFile(real, "# Title\n\nKeep this.\n");
  await symlink(real, link);
  await assert.rejects(collectMarkdownTargets([link]), /Not a Markdown file or directory/);
  await rm(dir, { recursive: true, force: true });
});
