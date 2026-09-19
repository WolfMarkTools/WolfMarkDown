#!/usr/bin/env node

import { formatMarkdown } from "../lib/format.mjs";
import { parseFlags, printHelp } from "../lib/cli.mjs";
import { assertRegularFileOrMissing, atomicWriteFile } from "../lib/publish.mjs";
import { isStdinPath, readTextSource } from "../lib/stdio.mjs";

async function main(argv) {
  const parsed = parseFlags(argv, ["--stdout", "--check"]);
  if (parsed.help) {
    printHelp(
      "WolfMarkDown formatter",
      "Usage: node scripts/format-markdown.mjs <file.md|-> [--stdout] [--check]",
    );
    return 0;
  }
  const file = parsed.positionals[0];
  if (!file || parsed.positionals.length !== 1) {
    throw new Error("Provide exactly one Markdown file path, or - to read standard input.");
  }
  if (isStdinPath(file) && !parsed.flags.stdout && !parsed.flags.check) {
    throw new Error("Standard input requires --stdout or --check.");
  }
  const input = await readTextSource(file);
  const formatted = await formatMarkdown(input);
  const label = isStdinPath(file) ? "stdin" : file;
  if (parsed.flags.check) {
    if (formatted !== input) {
      process.stderr.write(`${label} is not formatted.\n`);
      return 1;
    }
    process.stdout.write(`${label}: already formatted\n`);
    return 0;
  }
  if (parsed.flags.stdout) {
    process.stdout.write(formatted);
    return 0;
  }
  await assertRegularFileOrMissing(file);
  await atomicWriteFile(file, formatted);
  process.stdout.write(`${file}: formatted\n`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  },
);
