#!/usr/bin/env node

import { collectMarkdownTargets, mapLimit } from "../lib/batch.mjs";
import { parseFlags, printHelp } from "../lib/cli.mjs";
import { previewDocuments } from "../lib/preview.mjs";
import { atomicWriteFile } from "../lib/publish.mjs";
import {
  QUALITY_BOUNDARY,
  formatErrors,
  formatWarnings,
  summariseChecks,
  toReceipt,
} from "../lib/report.mjs";
import { isStdinPath, readTextSource } from "../lib/stdio.mjs";
import { verifyMarkdown } from "../lib/validate.mjs";

const CONCURRENCY = 4;

async function verifyOne(file, { integrityFrom, preview }) {
  const candidateText = await readTextSource(file);
  let integrityFromText;
  if (integrityFrom) integrityFromText = await readTextSource(integrityFrom);
  const result = await verifyMarkdown(candidateText, { integrityFromText });
  let previewResult = null;
  if (preview) {
    const sourceText = integrityFromText ?? candidateText;
    previewResult = await previewDocuments(sourceText, candidateText, { destination: file });
  }
  return toReceipt(result, {
    candidatePath: file,
    candidateText,
    integrityFromPath: integrityFrom ?? null,
    integrityFromText,
    preview: previewResult,
  });
}

function printTextReceipt(receipt) {
  process.stdout.write(`${receipt.files.candidate.path}\n${summariseChecks(receipt.checks)}\n`);
  const warningText = formatWarnings(receipt.warnings);
  if (warningText) process.stderr.write(`Warnings:\n${warningText}\n`);
  if (!receipt.ok) process.stderr.write(`${formatErrors(receipt.errors, receipt.issues)}\n`);
  if (receipt.preview) {
    process.stdout.write(
      [
        `Preview: ${receipt.preview.unchanged ? "unchanged" : receipt.preview.formattingOnly ? "formatting-only" : "changed"}`,
        `Headings ${receipt.preview.structure.headings.source} -> ${receipt.preview.structure.headings.candidate}`,
        `Tables ${receipt.preview.structure.tables.source} -> ${receipt.preview.structure.tables.candidate}`,
        receipt.preview.note,
        "",
      ].join("\n"),
    );
  }
}

async function resolveTargets(positionals) {
  if (positionals.length === 1 && isStdinPath(positionals[0])) return ["-"];
  if (positionals.some((path) => isStdinPath(path))) {
    throw new Error("Standard input cannot be combined with other file paths.");
  }
  return collectMarkdownTargets(positionals);
}

async function main(argv) {
  const parsed = parseFlags(argv, ["--integrity-from", "--json", "--preview", "--receipt"]);
  if (parsed.help) {
    printHelp(
      "WolfMarkDown verifier",
      "Usage: node scripts/verify-markdown.mjs <file.md|dir|-> [...] [--integrity-from <original.md>] [--preview] [--receipt <out.json>] [--json]",
    );
    return 0;
  }
  if (parsed.positionals.length < 1) {
    throw new Error("Provide at least one Markdown file, directory, or - for standard input.");
  }
  if (parsed.flags.integrityFrom && isStdinPath(parsed.flags.integrityFrom)) {
    throw new Error("--integrity-from cannot read standard input.");
  }
  const files = await resolveTargets(parsed.positionals);
  if (files.length === 0) {
    throw new Error("No Markdown files found.");
  }
  if (parsed.flags.integrityFrom && files.length !== 1) {
    throw new Error("--integrity-from requires exactly one Markdown file.");
  }

  const receipts = await mapLimit(files, CONCURRENCY, (file) =>
    verifyOne(file, { integrityFrom: parsed.flags.integrityFrom, preview: Boolean(parsed.flags.preview) }),
  );
  const ok = receipts.every((receipt) => receipt.ok);
  const payload =
    receipts.length === 1
      ? receipts[0]
      : { ok, qualityBoundary: QUALITY_BOUNDARY, results: receipts };

  if (parsed.flags.receipt) {
    await atomicWriteFile(parsed.flags.receipt, `${JSON.stringify(payload, null, 2)}\n`);
  }
  if (parsed.flags.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return ok ? 0 : 1;
  }

  if (receipts.length === 1) {
    printTextReceipt(receipts[0]);
  } else {
    for (const receipt of receipts) {
      process.stdout.write(`${receipt.files.candidate.path}: ${receipt.ok ? "PASS" : "FAIL"}\n`);
      if (!receipt.ok) process.stderr.write(`${formatErrors(receipt.errors, receipt.issues)}\n`);
    }
  }
  process.stdout.write(`${QUALITY_BOUNDARY}\n`);
  process.stdout.write(`Result: ${ok ? "PASS" : "FAIL"}\n`);
  return ok ? 0 : 1;
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
