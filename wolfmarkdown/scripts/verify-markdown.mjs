#!/usr/bin/env node

import { collectMarkdownTargets, mapLimit } from "../lib/batch.mjs";
import { parseFlags, printHelp } from "../lib/cli.mjs";
import { createIssue } from "../lib/issues.mjs";
import { previewDocuments } from "../lib/preview.mjs";
import { atomicWriteFile, assertDistinctPath } from "../lib/publish.mjs";
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

function errorReceipt({ file, candidateText = null, integrityFrom = null, integrityFromText = null, stage, error }) {
  const target = stage === "integrity-source" ? `integrity source ${integrityFrom}` : file;
  const issue = createIssue("read", `Could not read ${target}: ${error.message}`);
  return toReceipt(
    {
      ok: false,
      checks: { read: false },
      errors: [issue.message],
      issues: [issue],
      integrityCoverage: { checked: false, classes: {}, warnings: [] },
      timings: {},
    },
    { candidatePath: file, candidateText, integrityFromPath: integrityFrom, integrityFromText },
  );
}

async function verifyOne(file, { integrityFrom, preview, preserveStructure }) {
  let candidateText = null;
  try {
    candidateText = await readTextSource(file);
  } catch (error) {
    return errorReceipt({ file, stage: "candidate", error });
  }
  let integrityFromText = null;
  if (integrityFrom) {
    try {
      integrityFromText = await readTextSource(integrityFrom);
    } catch (error) {
      return errorReceipt({ file, candidateText, integrityFrom, stage: "integrity-source", error });
    }
  }
  try {
    const result = await verifyMarkdown(candidateText, { integrityFromText, preserveStructure });
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
  } catch (error) {
    return errorReceipt({ file, candidateText, integrityFrom: integrityFrom ?? null, integrityFromText, stage: "verify", error });
  }
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
  if (positionals.length === 1 && isStdinPath(positionals[0])) return { files: ["-"], skipped: [] };
  if (positionals.some((path) => isStdinPath(path))) {
    throw new Error("Standard input cannot be combined with other file paths.");
  }
  return collectMarkdownTargets(positionals);
}

function formatSkipped(skipped) {
  return skipped.map((entry) => `- ${entry.path} (${entry.reason})`).join("\n");
}

async function main(argv) {
  const parsed = parseFlags(argv, ["--integrity-from", "--json", "--preview", "--receipt", "--preserve-structure"]);
  if (parsed.help) {
    printHelp(
      "WolfMarkDown verifier",
      "Usage: node scripts/verify-markdown.mjs <file.md|dir|-> [...] [--integrity-from <original.md>] [--preserve-structure] [--preview] [--receipt <out.json>] [--json]",
    );
    return 0;
  }
  if (parsed.positionals.length < 1) {
    throw new Error("Provide at least one Markdown file, directory, or - for standard input.");
  }
  if (parsed.flags.integrityFrom && isStdinPath(parsed.flags.integrityFrom)) {
    throw new Error("--integrity-from cannot read standard input.");
  }
  if (parsed.flags["preserve-structure"] && !parsed.flags.integrityFrom) {
    throw new Error("--preserve-structure requires --integrity-from for a source baseline.");
  }
  const { files, skipped } = await resolveTargets(parsed.positionals);
  if (parsed.flags.integrityFrom && files.length !== 1 && files.length !== 0) {
    throw new Error("--integrity-from requires exactly one Markdown file.");
  }
  if (parsed.flags.receipt) {
    if (isStdinPath(parsed.flags.receipt)) {
      throw new Error("--receipt cannot write standard input.");
    }
    await assertDistinctPath(
      parsed.flags.receipt,
      [...files, parsed.flags.integrityFrom],
      `--receipt would overwrite a Markdown source: ${parsed.flags.receipt}`,
    );
  }
  if (files.length === 0) {
    const message =
      skipped.length > 0
        ? `No eligible Markdown files to verify; ${skipped.length} path(s) excluded:\n${formatSkipped(skipped)}`
        : "No Markdown files found.";
    const payload = { ok: false, qualityBoundary: QUALITY_BOUNDARY, results: [], skipped, error: message };
    if (skipped.length > 0) {
      process.stderr.write(`Skipped ${skipped.length} path(s) excluded from verification:\n${formatSkipped(skipped)}\n`);
    }
    if (parsed.flags.receipt) {
      await atomicWriteFile(parsed.flags.receipt, `${JSON.stringify(payload, null, 2)}\n`);
    }
    if (parsed.flags.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return 1;
    }
    process.stderr.write(`${message}\n`);
    process.stdout.write(`${QUALITY_BOUNDARY}\n`);
    process.stdout.write("Result: FAIL\n");
    return 1;
  }

  const receipts = await mapLimit(files, CONCURRENCY, (file) =>
    verifyOne(file, {
      integrityFrom: parsed.flags.integrityFrom,
      preview: Boolean(parsed.flags.preview),
      preserveStructure: Boolean(parsed.flags["preserve-structure"]),
    }),
  ).catch((error) => {
    throw new Error(`Batch verification failed before completing: ${error.message}`);
  });
  const ok = receipts.every((receipt) => receipt.ok);
  const payload =
    receipts.length === 1
      ? { ...receipts[0], skipped }
      : { ok, qualityBoundary: QUALITY_BOUNDARY, results: receipts, skipped };
  if (skipped.length > 0) {
    process.stderr.write(`Skipped ${skipped.length} path(s) excluded from verification:\n${formatSkipped(skipped)}\n`);
  }

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
    for (const receipt of receipts) printTextReceipt(receipt);
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
