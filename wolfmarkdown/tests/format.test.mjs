import assert from "node:assert/strict";
import test from "node:test";
import { formatMarkdown } from "../lib/format.mjs";
import { readFixture } from "./helpers.mjs";

test("already-clean documents are a no-op after formatting", async () => {
  const input = await readFixture("already-clean.md");
  const formatted = await formatMarkdown(input);
  assert.equal(formatted, await formatMarkdown(formatted));
  assert.match(formatted, /Privy is selected/);
});

test("formatter removes trailing spaces and repeated blank lines via Prettier", async () => {
  const formatted = await formatMarkdown(await readFixture("excessive-whitespace.md"));
  assert.equal(formatted.endsWith("\n"), true);
  assert.equal(formatted.endsWith("\n\n"), false);
  assert.doesNotMatch(formatted, /[ \t]\n/);
  assert.doesNotMatch(formatted, /\n{3,}/);
});

test("formatter leaves decorative and substantive emoji in place", async () => {
  const formatted = await formatMarkdown(await readFixture("emoji-status.md"));
  assert.match(formatted, /Tests passed ✅/);
  assert.match(formatted, /The affected characters are ✅, ❌ and ⚠️\./);
});

test("formatter does not strip conversation scaffolding", async () => {
  const formatted = await formatMarkdown(await readFixture("copied-agent-conversation.md"));
  assert.match(formatted, /Assistant:/);
  assert.match(formatted, /Absolutely/);
  assert.match(formatted, /I can also update the architecture document/);
});

test("formatter preserves fenced conversation-like strings", async () => {
  const formatted = await formatMarkdown(await readFixture("code-with-conversation.md"));
  assert.match(formatted, /console\.log\("Assistant: hello"\)/);
});

test("formatter preserves YAML frontmatter values", async () => {
  const formatted = await formatMarkdown(await readFixture("frontmatter.md"));
  assert.match(formatted, /^---\n[\s\S]*title: Signing research[\s\S]*---\n/u);
  assert.match(formatted, /count: 2/);
});

test("formatter does not convert unicode bullets by itself", async () => {
  const formatted = await formatMarkdown(await readFixture("malformed-lists.md"));
  assert.match(formatted, /• decorative bullet/);
});

test("formatter preserves speaker labels in a transcript", async () => {
  const formatted = await formatMarkdown(await readFixture("legitimate-transcript.md"));
  assert.match(formatted, /Interviewer:/);
  assert.match(formatted, /Support:/);
});
