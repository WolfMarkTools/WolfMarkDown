#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { parseFlags, printHelp } from "../lib/cli.mjs";
import { formatErrors, summariseChecks, toPublicResult } from "../lib/report.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";

async function main(argv) {
  const parsed = parseFlags(argv, ["--integrity-from", "--json"]);
  if (parsed.help) {
    printHelp(
      "WolfMarkDown verifier",
      "Usage: node scripts/verify-markdown.mjs <file.md> [--integrity-from <original.md>] [--json]",
    );
    return 0;
  }
  const file = parsed.positionals[0];
  if (!file || parsed.positionals.length !== 1) {
    throw new Error("Provide exactly one Markdown file path.");
  }
  const text = await readFile(file, "utf8");
  const integrityFromText = parsed.flags.integrityFrom
    ? await readFile(parsed.flags.integrityFrom, "utf8")
    : undefined;
  const result = await verifyMarkdown(text, { integrityFromText });
  if (parsed.flags.json) {
    process.stdout.write(`${JSON.stringify(toPublicResult(result), null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  process.stdout.write(`${file}\n${summariseChecks(result.checks)}\n`);
  if (!result.ok) {
    process.stderr.write(`${formatErrors(result.errors)}\n`);
    return 1;
  }
  process.stdout.write("Result: PASS\n");
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
