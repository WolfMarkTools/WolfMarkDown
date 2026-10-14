#!/usr/bin/env node

import { separateAdjacentCitations } from "../lib/citations.mjs";
import { formatMarkdown } from "../lib/format.mjs";
import { parseFlags, printHelp } from "../lib/cli.mjs";
import { assertRegularFileOrMissing, atomicWriteFile } from "../lib/publish.mjs";
import { isStdinPath, readTextSource } from "../lib/stdio.mjs";

async function main(argv) {
  const parsed = parseFlags(argv, ["--stdout", "--check", "--safe-fixes"]);
  if (parsed.help) {
    printHelp(
      "WolfMarkDown formatter",
      "Usage: node scripts/format-markdown.mjs <file.md|-> [--stdout] [--check] [--safe-fixes]\n--safe-fixes applies allow-listed lexical repairs (separating adjacent numeric citations in recognised ledgers) before formatting.",
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
  if (parsed.flags.stdout && parsed.flags.check) {
    throw new Error("Conflicting flags: use either --stdout or --check, not both.");
  }
  const original = await readTextSource(file);
  let input = original;
  const label = isStdinPath(file) ? "stdin" : file;
  let safeFixes = 0;
  if (parsed.flags["safe-fixes"]) {
    const fixed = separateAdjacentCitations(input);
    input = fixed.text;
    safeFixes = fixed.applied;
    if (safeFixes > 0) {
      process.stderr.write(
        `${label}: ${safeFixes} safe citation fix(es) ${parsed.flags.check ? "would be applied" : "applied"}\n`,
      );
    }
  }
  const formatted = await formatMarkdown(input);
  if (parsed.flags.check) {
    // Check mode compares against the original text: a write pass with the
    // given flags would change the file whenever formatting or safe fixes
    // differ from what is on disk.
    if (formatted !== original) {
      process.stderr.write(
        safeFixes > 0
          ? `${label} is not formatted or requires safe fixes.\n`
          : `${label} is not formatted.\n`,
      );
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
