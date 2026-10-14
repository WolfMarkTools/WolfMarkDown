// Citation-aware diagnostics and the controlled citation safe fix.
//
// Adjacent numeric citations written without a space ([6][26]) are parsed
// by GFM as a single reference link whose label is undefined, which
// markdownlint reports as MD052. WolfMarkDown detects the citation shape
// itself so it can give a citation-specific remediation, deduplicate the
// MD052 finding by structured rule identifier and line range, and offer a
// single, opt-in lexical repair: inserting the separating space.
//
// The repair respects Markdown structure: fenced code, indented code,
// inline code, escaped brackets, reference definitions and genuine
// reference links (right label defined) are never modified. It applies
// only in documents with a recognised citation ledger.
import { lineFenceStates } from "./fences.mjs";
import { createIssue } from "./issues.mjs";
import { detectRecordRuns, maskInlineCodeSpans } from "./preservation.mjs";

const ADJACENT = /\[(\d{1,3})\]\[(\d{1,3})\]/gu;
const DEFINITION = /^ {0,3}\[([^\]]+)\]:/u;
const MARKER = /\[(\d{1,3})\]/gu;
const RECORD_LINE = /^ {0,3}(?:[-*+] )?\[\d{1,3}\]\s/u;

function isEscaped(line, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function visibleLines(text) {
  const { lines, inside } = lineFenceStates(text);
  return lines.map((line, index) => ({ line, index, skip: inside[index] || /^ {4,}/u.test(line) }));
}

function maskedLines(text) {
  return maskInlineCodeSpans(text).split("\n");
}

export function referenceDefinitions(text) {
  const labels = new Set();
  for (const { line, skip } of visibleLines(text)) {
    if (skip) continue;
    const match = line.match(DEFINITION);
    if (match) labels.add(match[1]);
  }
  return labels;
}

export function findAdjacentCitationPairs(text) {
  const pairs = [];
  const masked = maskedLines(text);
  for (const { line, index, skip } of visibleLines(text)) {
    if (skip) continue;
    for (const match of (masked[index] ?? "").matchAll(ADJACENT)) {
      if (isEscaped(line, match.index)) continue;
      pairs.push({
        line: index + 1,
        column: match.index + 1,
        left: match[1],
        right: match[2],
        range: [match.index + 1, match[0].length],
      });
    }
  }
  return pairs;
}

export function ledgerLabels(text) {
  const labels = new Set();
  for (const run of detectRecordRuns(text)) {
    for (const record of run.records) labels.add(record.label);
  }
  return labels;
}

function numericMarkers(text) {
  const markers = [];
  const masked = maskedLines(text);
  for (const { line, index, skip } of visibleLines(text)) {
    if (skip || RECORD_LINE.test(line)) continue;
    for (const match of (masked[index] ?? "").matchAll(MARKER)) {
      if (isEscaped(line, match.index)) continue;
      markers.push({ line: index + 1, label: match[1] });
    }
  }
  return markers;
}

export function checkCitations(text, { crossReference = false } = {}) {
  const definitions = referenceDefinitions(text);
  const pairs = findAdjacentCitationPairs(text).filter((pair) => !definitions.has(pair.right));
  const issues = pairs.map((pair) =>
    createIssue(
      "citations",
      `Adjacent numeric citations [${pair.left}][${pair.right}] are parsed as one reference link; separate them with a space ([${pair.left}] [${pair.right}]).`,
      { line: pair.line, column: pair.column },
    ),
  );
  const warnings = [];
  const missing = [];
  if (crossReference) {
    const labels = ledgerLabels(text);
    if (labels.size > 0) {
      const seen = new Set();
      for (const marker of numericMarkers(text)) {
        if (labels.has(marker.label) || seen.has(marker.label)) continue;
        seen.add(marker.label);
        missing.push(marker.label);
        warnings.push({
          code: "citation-not-in-ledger",
          message: `Citation [${marker.label}] does not match any record in the detected ledger (line ${marker.line}); review the reference.`,
          examples: [`[${marker.label}]`],
        });
      }
    }
  }
  return { ok: issues.length === 0, issues, warnings, pairs, missing };
}

export function separateAdjacentCitations(text) {
  const labels = ledgerLabels(text);
  if (labels.size === 0) return { text, applied: 0 };
  const definitions = referenceDefinitions(text);
  const masked = maskedLines(text);
  const { inside } = lineFenceStates(text);
  let applied = 0;
  const output = text.split("\n").map((line, index) => {
    if (inside[index] || /^ {4,}/u.test(line)) return line;
    const matches = [...(masked[index] ?? "").matchAll(ADJACENT)].filter(
      (match) => !isEscaped(line, match.index) && !definitions.has(match[2]),
    );
    let result = line;
    for (const match of matches.reverse()) {
      const boundary = match.index + 1 + match[1].length;
      result = `${result.slice(0, boundary + 1)} ${result.slice(boundary + 1)}`;
      applied += 1;
    }
    return result;
  });
  return { text: output.join("\n"), applied };
}
