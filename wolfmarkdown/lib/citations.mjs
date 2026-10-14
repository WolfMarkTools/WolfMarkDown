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
import { createIssue } from "./issues.mjs";
import { detectRecordRuns, maskMarkdownNodes } from "./preservation.mjs";

// Consume only the left marker so every boundary in a chain is visible.
const ADJACENT = /\[(\d{1,3})\](?=\[(\d{1,3})\])/gu;
const MARKER = /\[(\d{1,3})\]/gu;
const RECORD_LINE = /^ {0,3}(?:[-*+] )?\[\d{1,3}\]\s/u;

function isEscaped(line, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function maskedLines(text) {
  // Protect complete parsed links, not merely their defined right labels:
  // an overlapping pair can otherwise start or end inside a genuine link.
  return maskMarkdownNodes(text, [
    "code", "inlineCode", "definition", "link", "linkReference",
    "image", "imageReference", "html", "yaml",
  ]).split("\n");
}

export function findAdjacentCitationPairs(text) {
  const pairs = [];
  const masked = maskedLines(text);
  for (const [index, line] of text.split("\n").entries()) {
    for (const match of masked[index].matchAll(ADJACENT)) {
      if (isEscaped(line, match.index)) continue;
      pairs.push({
        line: index + 1,
        column: match.index + 1,
        left: match[1],
        right: match[2],
        range: [match.index + 1, match[0].length + match[2].length + 2],
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
  for (const [index, line] of text.split("\n").entries()) {
    if (RECORD_LINE.test(line)) continue;
    for (const match of (masked[index] ?? "").matchAll(MARKER)) {
      if (isEscaped(line, match.index)) continue;
      markers.push({ line: index + 1, label: match[1] });
    }
  }
  return markers;
}

export function checkCitations(text, { crossReference = false } = {}) {
  const pairs = findAdjacentCitationPairs(text);
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
  const pairs = findAdjacentCitationPairs(text);
  const boundaries = new Map();
  for (const pair of pairs) {
    const offsets = boundaries.get(pair.line) ?? [];
    offsets.push(pair.column - 1 + pair.left.length + 2);
    boundaries.set(pair.line, offsets);
  }
  let applied = 0;
  const output = text.split("\n").map((line, index) => {
    let result = line;
    for (const boundary of (boundaries.get(index + 1) ?? []).reverse()) {
      result = `${result.slice(0, boundary)} ${result.slice(boundary)}`;
      applied += 1;
    }
    return result;
  });
  return { text: output.join("\n"), applied };
}
