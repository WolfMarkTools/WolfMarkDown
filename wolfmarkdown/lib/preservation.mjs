// Structure-preservation helpers: ordinal-run and record-run extraction and
// contextual comparison between an untouched source snapshot and a candidate.
//
// Ordinal runs are compared by item identity — an anchor derived from the
// item's own text — within the candidate list that best corresponds to the
// source list, so a matching number appearing in an unrelated sequence
// cannot satisfy preservation. Positions use effective rendered numbering
// (the list's start value plus the item index), which is insensitive to
// incidental notation such as marker punctuation, all-ones item numbering,
// or a printer normalising gaps in a sequential run.
//
// Record runs are ledger-style lines (a bracketed numeric label followed by
// a value, usually a URL). Each source record must survive on its own line,
// in order, in the candidate; fenced code, indented code and inline code are
// masked so they cannot satisfy or fabricate records.
//
// Checked only when structural preservation is requested; the untouched
// source snapshot is the baseline.
import { visit } from "unist-util-visit";
import { lineFenceStates } from "./fences.mjs";
import { createIssue } from "./issues.mjs";
import { parseMarkdown } from "./parse.mjs";
import { evaluateRecordBoundaries } from "./semantic-eval.mjs";

const MAX_ANCHOR_WORDS = 5;
const TRAILING_PUNCT = /^[—–\-:;,·•.]+$/u;
const DASH_SPLIT = /\s+[—–]\s+/u;

export function plainText(node) {
  if (!node) return "";
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  if (node.type === "image") return node.alt ?? "";
  if (!node.children) return "";
  return node.children.map((child) => plainText(child)).join("");
}

function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

// A short, stable identity for a list item: its leading phrase up to an
// em-dash separator, otherwise its first few words, with trailing
// punctuation removed. Emphasis and whitespace changes do not affect it.
export function itemAnchor(text) {
  const collapsed = collapseWhitespace(text);
  if (!collapsed) return "";
  const base = collapsed.split(DASH_SPLIT)[0] || collapsed;
  const words = base.split(" ").filter(Boolean).slice(0, MAX_ANCHOR_WORDS);
  while (words.length > 1 && TRAILING_PUNCT.test(words[words.length - 1])) words.pop();
  return words.join(" ").replace(/[:;,]+$/u, "").trim();
}

export function normaliseHeading(text) {
  return collapseWhitespace(text)
    .toLowerCase()
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/u, "");
}

function collectHeadings(tree) {
  const headings = [];
  visit(tree, "heading", (node) => {
    headings.push({
      depth: node.depth,
      text: collapseWhitespace(plainText(node)),
      offset: node.position?.start?.offset ?? null,
    });
  });
  return headings;
}

function contextFor(headings, offset) {
  const stack = [];
  for (const heading of headings) {
    if (offset == null || heading.offset == null || heading.offset > offset) break;
    while (stack.length > 0 && stack[stack.length - 1].depth >= heading.depth) stack.pop();
    stack.push(heading);
  }
  return stack.map((heading) => ({
    depth: heading.depth,
    text: heading.text,
    normalised: normaliseHeading(heading.text),
  }));
}

// Extract ordered-list runs with their item identities, effective positions
// and heading context. Runs with fewer than two identified items are
// ignored: a single ordered item carries no sequence to preserve.
export function extractOrdinalRuns(text) {
  const { tree } = parseMarkdown(text);
  const headings = collectHeadings(tree);
  const runs = [];
  visit(tree, "list", (node) => {
    if (!node.ordered || !node.children || node.children.length < 2) return;
    const start =
      typeof node.start === "number" && Number.isFinite(node.start) && node.start > 0 ? node.start : 1;
    const items = [];
    node.children.forEach((item, index) => {
      const anchor = itemAnchor(plainText(item));
      if (anchor) items.push({ anchor, position: start + index });
    });
    if (items.length < 2) return;
    runs.push({
      start,
      count: items.length,
      items,
      context: contextFor(headings, node.position?.start?.offset ?? null),
      line: node.position?.start?.line ?? null,
    });
  });
  return runs;
}

// The correspondence key is the run's complete normalised heading ancestry:
// two subsections sharing a name under different parents are different
// contexts, not one shared pool.
function headingPathKey(run) {
  return run.context.map((entry) => entry.normalised).join("\u0000");
}

// Every heading ancestry chain present in a document, used to decide whether
// a section still exists in the candidate.
function headingPathKeys(text) {
  const { tree } = parseMarkdown(text);
  const paths = new Set();
  const stack = [];
  for (const heading of collectHeadings(tree)) {
    while (stack.length > 0 && stack[stack.length - 1].depth >= heading.depth) stack.pop();
    stack.push(heading);
    paths.add(stack.map((entry) => normaliseHeading(entry.text)).join("\u0000"));
  }
  return paths;
}

function nearestHeadingText(run) {
  return run.context.length > 0 ? run.context[run.context.length - 1].text : null;
}

function sectionLabel(run) {
  const heading = nearestHeadingText(run);
  return heading ? ` in section "${heading}"` : "";
}

function longestCommonSubsequenceLength(left, right) {
  if (left.length === 0 || right.length === 0) return 0;
  let previous = new Array(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    const current = new Array(right.length + 1).fill(0);
    for (let j = 1; j <= right.length; j += 1) {
      current[j] =
        left[i - 1] === right[j - 1]
          ? previous[j - 1] + 1
          : Math.max(previous[j], current[j - 1]);
    }
    previous = current;
  }
  return previous[right.length];
}

// Correspondence is restricted to candidate runs in the same heading
// context: a lookalike list in another section must not be able to satisfy
// a sequence whose own context cannot be confirmed.
function bestCorrespondence(sourceRun, candidateRuns) {
  const anchors = sourceRun.items.map((item) => item.anchor);
  const contextKey = headingPathKey(sourceRun);
  let best = null;
  for (const run of candidateRuns) {
    if (headingPathKey(run) !== contextKey) continue;
    const score = longestCommonSubsequenceLength(
      anchors,
      run.items.map((item) => item.anchor),
    );
    if (best == null || score > best.score) best = { run, score };
  }
  return best;
}

export function checkOrdinalPreservation(snapshotText, candidateText, options = {}) {
  const { section = null } = options;
  let sourceRuns = options.runs ?? extractOrdinalRuns(snapshotText);
  if (section != null) {
    const wanted = normaliseHeading(section);
    sourceRuns = sourceRuns.filter((run) =>
      run.context.some((entry) => entry.normalised === wanted),
    );
  }
  const candidateRuns = extractOrdinalRuns(candidateText);
  const candidateHeadingPaths = headingPathKeys(candidateText);
  const issues = [];
  const warnings = [];
  let itemsChecked = 0;
  const claimed = new Set();

  for (const run of sourceRuns) {
    const anchors = run.items.map((item) => item.anchor);
    const best = bestCorrespondence(
      run,
      candidateRuns.filter((candidate) => !claimed.has(candidate)),
    );
    const threshold = Math.max(1, Math.ceil(run.count / 2));
    if (best == null || best.score < threshold) {
      const anywhere = candidateRuns.some((candidate) =>
        candidate.items.some((item) => anchors.includes(item.anchor)),
      );
      if (!anywhere) {
        issues.push(
          createIssue(
            "ordinals",
            `Ordered list starting at line ${run.line} is missing from the candidate (items: ${anchors
              .slice(0, 3)
              .join(", ")}). Ordered numbering must survive preservation checks.`,
            { line: run.line },
          ),
        );
      } else if (
        best == null &&
        run.context.length > 0 &&
        candidateHeadingPaths.has(headingPathKey(run))
      ) {
        issues.push(
          createIssue(
            "ordinals",
            `Ordered list starting at line ${run.line} no longer exists${sectionLabel(run)}; its items were found in a different ordered list instead. Its original sequence position must be preserved, or the change reconciled deliberately.`,
            { line: run.line },
          ),
        );
      } else {
        warnings.push({
          code: "ordinal-context-ambiguous",
          message:
            `Could not confirm the sequence context for the ordered list starting at line ${run.line} ` +
            `(items: ${anchors.slice(0, 3).join(", ")}). Report this ambiguity rather than treating the numbering as preserved.`,
          examples: anchors.slice(0, 3),
        });
      }
      continue;
    }

    // Each candidate list can correspond to at most one source sequence, so
    // a single surviving lookalike cannot satisfy two source runs.
    claimed.add(best.run);

    // Item lookups are confined to the candidate list selected for this
    // source run; sibling lists in the same section must not combine to
    // complete a partial match.
    const pool = [best.run];
    const poolItems = [];
    for (const candidate of pool) {
      for (const item of candidate.items) {
        poolItems.push({ anchor: item.anchor, position: item.position, run: candidate });
      }
    }
    const consumed = new Set();
    for (const sourceItem of run.items) {
      itemsChecked += 1;
      const index = poolItems.findIndex(
        (item, itemIndex) => !consumed.has(itemIndex) && item.anchor === sourceItem.anchor,
      );
      if (index === -1) {
        const elsewhere = candidateRuns.some((candidate) =>
          candidate.items.some((item) => item.anchor === sourceItem.anchor),
        );
        if (elsewhere) {
          issues.push(
            createIssue(
              "ordinals",
              `Ordered item "${sourceItem.anchor}" expected at position ${sourceItem.position}${sectionLabel(run)} ` +
                "was found in a different ordered list instead; its original sequence position must be preserved.",
              { line: run.line },
            ),
          );
        } else {
          issues.push(
            createIssue(
              "ordinals",
              `Ordered item "${sourceItem.anchor}" was not found in any ordered list in the candidate; ` +
                `its position ${sourceItem.position}${sectionLabel(run)} cannot be preserved.`,
              { line: run.line },
            ),
          );
        }
        continue;
      }
      consumed.add(index);
      const found = poolItems[index];
      if (found.position !== sourceItem.position) {
        issues.push(
          createIssue(
            "ordinals",
            `Ordered item "${sourceItem.anchor}" is at position ${found.position} but was at position ` +
              `${sourceItem.position}${sectionLabel(run)}. Preserve the original numbering or reconcile the change deliberately.`,
            { line: found.run.line },
          ),
        );
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    runsChecked: sourceRuns.length,
    itemsChecked,
  };
}

// --- Record runs ---------------------------------------------------------

const RECORD_PREFIX = /^ {0,3}(?:[-*+] )?\[(\d{1,3})\]\s+(\S.*)$/u;

// GFM inline code spans are delimited by equal-length backtick runs; they
// must be matched by run length, not by pairing individual characters.
// Returns [start, end) ranges covering the delimiters and their content.
function codeSpans(line) {
  const spans = [];
  let index = 0;
  while (index < line.length) {
    if (line[index] !== "`") {
      index += 1;
      continue;
    }
    let openEnd = index;
    while (openEnd < line.length && line[openEnd] === "`") openEnd += 1;
    const runLength = openEnd - index;
    let cursor = openEnd;
    let spanEnd = -1;
    while (cursor < line.length) {
      if (line[cursor] !== "`") {
        cursor += 1;
        continue;
      }
      let closeEnd = cursor;
      while (closeEnd < line.length && line[closeEnd] === "`") closeEnd += 1;
      if (closeEnd - cursor === runLength) {
        spanEnd = closeEnd;
        break;
      }
      cursor = closeEnd;
    }
    if (spanEnd === -1) {
      index = openEnd;
      continue;
    }
    spans.push([index, spanEnd]);
    index = spanEnd;
  }
  return spans;
}

function insideAnySpan(offset, spans) {
  return spans.some(([start, end]) => offset >= start && offset < end);
}

export function maskInlineCode(line) {
  const chars = line.split("");
  for (const [start, end] of codeSpans(line)) {
    for (let cursor = start; cursor < end; cursor += 1) chars[cursor] = " ";
  }
  return chars.join("");
}

// Mask every GFM inline code span in a document, including spans that cross
// line breaks, using the parsed span positions. Line breaks inside a span
// are preserved so line and column offsets stay stable.
export function maskInlineCodeSpans(text) {
  let ranges = [];
  try {
    const { tree } = parseMarkdown(text);
    visit(tree, "inlineCode", (node) => {
      const start = node.position?.start?.offset ?? null;
      const end = node.position?.end?.offset ?? null;
      if (start != null && end != null && end > start) ranges.push([start, end]);
    });
  } catch {
    const lines = text.split("\n");
    return lines.map((line) => maskInlineCode(line)).join("\n");
  }
  if (ranges.length === 0) return text;
  const chars = text.split("");
  for (const [start, end] of ranges) {
    for (let cursor = start; cursor < end; cursor += 1) {
      if (chars[cursor] !== "\n") chars[cursor] = " ";
    }
  }
  return chars.join("");
}

// Line numbers (1-based) covered by fenced or indented code blocks anywhere
// in the document, including blocks inside blockquotes and list items.
export function codeBlockLines(text) {
  const lines = new Set();
  try {
    const { tree } = parseMarkdown(text);
    visit(tree, "code", (node) => {
      const start = node.position?.start?.line ?? null;
      const end = node.position?.end?.line ?? null;
      if (start == null || end == null) return;
      for (let line = start; line <= end; line += 1) lines.add(line);
    });
  } catch {
    return lines;
  }
  return lines;
}

// Detect ledger-style record runs: three or more consecutive lines that
// begin with a bracketed numeric label outside fenced code, indented code
// and inline code. Each record keeps its label and the first token after it
// (usually the URL) as its identity.
export function detectRecordRuns(text) {
  const { lines, inside } = lineFenceStates(text);
  const runs = [];
  let current = [];
  const flush = () => {
    if (current.length >= 3) {
      runs.push({
        startLine: current[0].line,
        endLine: current[current.length - 1].line,
        count: current.length,
        records: current.map((entry) => entry.record),
      });
    }
    current = [];
  };
  lines.forEach((line, index) => {
    if (inside[index] || /^ {4,}/u.test(line)) {
      flush();
      return;
    }
    const match = line.match(RECORD_PREFIX);
    if (!match) {
      flush();
      return;
    }
    const labelOffset = match[0].indexOf("[");
    if (insideAnySpan(labelOffset, codeSpans(line))) {
      flush();
      return;
    }
    const label = match[1];
    const anchor = match[2].trim().split(/\s+/u)[0];
    current.push({ line: index + 1, record: { label, anchor, tokens: [`[${label}]`, anchor] } });
  });
  flush();
  return runs;
}

function maskForRecordMatching(text) {
  const { lines, inside } = lineFenceStates(text);
  const codeLines = codeBlockLines(text);
  const masked = maskInlineCodeSpans(text).split("\n");
  return lines
    .map((line, index) => {
      if (inside[index] || codeLines.has(index + 1) || /^ {4,}/u.test(line)) return "";
      return masked[index] ?? "";
    })
    .join("\n");
}

// Each source record must survive on its own line, in order, with its label
// and value associated. Reuses the semantic-evaluation boundary matcher so
// "record boundaries" mean the same thing everywhere.
export function checkRecordPreservation(snapshotText, candidateText, options = {}) {
  const runs = options.runs ?? detectRecordRuns(snapshotText);
  if (runs.length === 0) {
    return { ok: true, issues: [], warnings: [], runsChecked: 0, recordsChecked: 0 };
  }
  const records = [];
  for (const run of runs) {
    for (const record of run.records) records.push(record.tokens);
  }
  const boundary = evaluateRecordBoundaries(maskForRecordMatching(candidateText), records);
  const issues = [];
  for (const entry of boundary.results) {
    if (!entry.error) continue;
    issues.push(createIssue("records", entry.error, { line: entry.line ?? null }));
  }
  return {
    ok: issues.length === 0,
    issues,
    warnings: [],
    runsChecked: runs.length,
    recordsChecked: records.length,
  };
}
