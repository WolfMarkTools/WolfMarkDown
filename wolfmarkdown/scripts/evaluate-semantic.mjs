#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { evaluateSemanticProperties } from "../lib/semantic-eval.mjs";
import { loadJson } from "../lib/paths.mjs";

function printHelp() {
  process.stdout.write(
    "WolfMarkDown semantic property evaluator\n\nUsage: node scripts/evaluate-semantic.mjs --case <name> <source.md> <candidate.md> [--json]\n",
  );
}

function parseArgs(args) {
  const positionals = [];
  let caseName;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--case") {
      caseName = args[index + 1];
      if (!caseName || caseName.startsWith("--")) throw new Error("--case requires a case name.");
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown flag: ${arg}`);
    positionals.push(arg);
  }
  if (!caseName || positionals.length !== 2) {
    throw new Error("Provide --case, one source file, and one candidate file.");
  }
  return { caseName, json, positionals };
}

async function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    printHelp();
    return 0;
  }
  const cases = loadJson("tests/evals/semantic-properties.json");
  const properties = cases[parsed.caseName];
  if (!properties) throw new Error(`Unknown semantic evaluation case: ${parsed.caseName}`);
  const [sourcePath, candidatePath] = parsed.positionals;
  const [sourceText, candidateText] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(candidatePath, "utf8"),
  ]);
  const result = evaluateSemanticProperties(sourceText, candidateText, properties);
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`Case: ${parsed.caseName}\n`);
    process.stdout.write(`Headings: ${result.checks.headings ? "PASS" : "FAIL"}\n`);
    process.stdout.write(`Tables: ${result.checks.tables ? "PASS" : "FAIL"}\n`);
    process.stdout.write(`Preservation: ${result.checks.preservation ? "PASS" : "FAIL"}\n`);
    process.stdout.write(`Records: ${result.checks.records ? "PASS" : "FAIL"}\n`);
    process.stdout.write(`Integrity: ${result.checks.integrity ? "PASS" : "FAIL"}\n`);
    process.stdout.write(`Ambiguity: ${result.checks.ambiguity ? "PASS" : "FAIL"}\n`);
    if (result.errors.length > 0) process.stderr.write(`${result.errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.stdout.write(`Result: ${result.ok ? "PASS" : "FAIL"}\n`);
  }
  return result.ok ? 0 : 1;
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
