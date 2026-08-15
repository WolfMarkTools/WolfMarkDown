#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { formatMarkdown } from "../lib/format.mjs";
import { parseFlags, printHelp } from "../lib/cli.mjs";

async function main(argv) {
  const parsed = parseFlags(argv, ["--stdout", "--check"]);
  if (parsed.help) {
    printHelp(
      "WolfMarkDown formatter",
      "Usage: node scripts/format-markdown.mjs <file.md> [--stdout] [--check]",
    );
    return 0;
  }
  const file = parsed.positionals[0];
  if (!file || parsed.positionals.length !== 1) {
    throw new Error("Provide exactly one Markdown file path.");
  }
  const input = await readFile(file, "utf8");
  const formatted = await formatMarkdown(input);
  if (parsed.flags.check) {
    if (formatted !== input) {
      process.stderr.write(`${file} is not formatted.\n`);
      return 1;
    }
    process.stdout.write(`${file}: already formatted\n`);
    return 0;
  }
  if (parsed.flags.stdout) {
    process.stdout.write(formatted);
    return 0;
  }
  await writeFile(file, formatted);
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
