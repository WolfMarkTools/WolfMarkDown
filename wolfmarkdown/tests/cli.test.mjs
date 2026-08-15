import assert from "node:assert/strict";
import test from "node:test";
import { parseFlags } from "../lib/cli.mjs";

test("rejects unknown dash-prefixed arguments", () => {
  assert.throws(() => parseFlags(["-check"], ["--check"]), /Unknown flag: -check/);
  assert.throws(() => parseFlags(["--foo"], ["--json"]), /Unknown flag: --foo/);
  assert.throws(() => parseFlags(["--mode"], ["--json"]), /--mode is not supported/);
});

test("keeps supported long flags and file paths", () => {
  const parsed = parseFlags(["notes.md", "--check", "docs/a.md"], ["--check", "--stdout"]);
  assert.deepEqual(parsed.positionals, ["notes.md", "docs/a.md"]);
  assert.equal(parsed.flags.check, true);
});

test("treats -h as help without consuming file paths", () => {
  assert.equal(parseFlags(["-h", "notes.md"], ["--check"]).help, true);
});
