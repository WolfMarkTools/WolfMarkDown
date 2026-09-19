#!/usr/bin/env node

import { parseFlags, printHelp } from "../lib/cli.mjs";
import { documentScaffold } from "../lib/scaffold.mjs";
import { isStdinPath, readTextSource } from "../lib/stdio.mjs";

async function main(argv) {
  const parsed = parseFlags(argv, ["--json"]);
  if (parsed.help) {
    printHelp(
      "WolfMarkDown source scaffold",
      "Usage: node scripts/scaffold-markdown.mjs <file.md|-> [--json]",
    );
    return 0;
  }
  const file = parsed.positionals[0];
  if (!file || parsed.positionals.length !== 1) {
    throw new Error("Provide exactly one Markdown file path, or - to read standard input.");
  }
  const text = await readTextSource(file);
  const scaffold = documentScaffold(text);
  if (parsed.flags.json) {
    process.stdout.write(`${JSON.stringify({ path: isStdinPath(file) ? "-" : file, ...scaffold }, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(
    [
      isStdinPath(file) ? "stdin" : file,
      `Lines: ${scaffold.lineCount}`,
      `Headings: ${scaffold.headings.length}`,
      `GFM tables: ${scaffold.gfmTables}`,
      `Pipe runs: ${scaffold.pipeRuns.length}`,
      `Lists: ${scaffold.lists.length}`,
      `Fences: ${scaffold.fences.length}`,
      scaffold.note,
      "",
    ].join("\n"),
  );
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
