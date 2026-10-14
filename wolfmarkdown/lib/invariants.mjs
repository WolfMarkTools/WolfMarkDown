// Declared preservation invariants: a source-bound JSON declaration the
// agent writes after building its source map. Declarations are validated,
// bound to the untouched source snapshot by SHA-256, and checked against
// both the source (source-grounding) and the candidate (preservation).
//
// Schema (version 1):
// {
//   "version": 1,
//   "sourceSha256": "<sha256 of the snapshot used with --integrity-from>",
//   "preserve": {
//     "headings": ["Sources"],
//     "recordRuns": [{ "id": "sources", "section": "Sources", "count": 20 }],
//     "ordinalRuns": [{ "id": "ranking", "section": "Performance ranking", "start": 6, "end": 16 }]
//   },
//   "require": { "headings": ["Candidate-only heading"] }
// }
//
// "preserve" requirements must exist in the source snapshot and survive in
// the candidate; "require" requirements are candidate-only (for example a
// heading added by an authorised repair). Record counts are source-grounded
// here; per-record line boundaries are covered by the records check.
import { visit } from "unist-util-visit";
import { createIssue } from "./issues.mjs";
import { parseMarkdown } from "./parse.mjs";
import {
  checkOrdinalPreservation,
  checkRecordPreservation,
  detectRecordRuns,
  extractOrdinalRuns,
  normaliseHeading,
  plainText,
} from "./preservation.mjs";
import { hashText } from "./report.mjs";

const TOP_KEYS = new Set(["version", "sourceSha256", "preserve", "require"]);
const PRESERVE_KEYS = new Set(["headings", "recordRuns", "ordinalRuns"]);
const REQUIRE_KEYS = new Set(["headings"]);
const SHA256 = /^[0-9a-fA-F]{64}$/u;

function isPlainObject(value) {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function unknownKeys(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

export function parseInvariants(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`Invariants file is not valid JSON: ${error.message}`] };
  }
  const errors = [];
  if (!isPlainObject(value)) {
    return { ok: false, errors: ["Invariants must be a JSON object."] };
  }
  for (const key of unknownKeys(value, TOP_KEYS)) errors.push(`Unknown invariants key: ${key}`);
  if (value.version !== 1) errors.push("Invariants version must be 1.");
  if (typeof value.sourceSha256 !== "string" || !SHA256.test(value.sourceSha256)) {
    errors.push("sourceSha256 must be the SHA-256 hash of the source snapshot.");
  }

  const preserve = value.preserve ?? {};
  if (!isPlainObject(preserve)) errors.push("preserve must be an object when present.");
  const requireBlock = value.require ?? {};
  if (!isPlainObject(requireBlock)) errors.push("require must be an object when present.");

  if (isPlainObject(preserve)) {
    for (const key of unknownKeys(preserve, PRESERVE_KEYS)) errors.push(`Unknown preserve key: ${key}`);
    if (preserve.headings != null) {
      if (!Array.isArray(preserve.headings) || preserve.headings.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
        errors.push("preserve.headings must be an array of non-empty strings.");
      }
    }
    if (preserve.recordRuns != null) {
      if (!Array.isArray(preserve.recordRuns)) {
        errors.push("preserve.recordRuns must be an array.");
      } else {
        preserve.recordRuns.forEach((entry, index) => {
          if (!isPlainObject(entry)) {
            errors.push(`preserve.recordRuns[${index}] must be an object.`);
            return;
          }
          for (const key of unknownKeys(entry, new Set(["id", "section", "count"]))) {
            errors.push(`Unknown preserve.recordRuns[${index}] key: ${key}`);
          }
          if (typeof entry.section !== "string" || entry.section.trim() === "") {
            errors.push(`preserve.recordRuns[${index}].section must be a non-empty heading text.`);
          }
          if (!Number.isInteger(entry.count) || entry.count < 1) {
            errors.push(`preserve.recordRuns[${index}].count must be a positive integer.`);
          }
          if (entry.id != null && typeof entry.id !== "string") {
            errors.push(`preserve.recordRuns[${index}].id must be a string when present.`);
          }
        });
      }
    }
    if (preserve.ordinalRuns != null) {
      if (!Array.isArray(preserve.ordinalRuns)) {
        errors.push("preserve.ordinalRuns must be an array.");
      } else {
        preserve.ordinalRuns.forEach((entry, index) => {
          if (!isPlainObject(entry)) {
            errors.push(`preserve.ordinalRuns[${index}] must be an object.`);
            return;
          }
          for (const key of unknownKeys(entry, new Set(["id", "section", "start", "end"]))) {
            errors.push(`Unknown preserve.ordinalRuns[${index}] key: ${key}`);
          }
          if (typeof entry.section !== "string" || entry.section.trim() === "") {
            errors.push(`preserve.ordinalRuns[${index}].section must be a non-empty heading text.`);
          }
          if (!Number.isInteger(entry.start) || entry.start < 1) {
            errors.push(`preserve.ordinalRuns[${index}].start must be a positive integer.`);
          }
          if (!Number.isInteger(entry.end) || !Number.isInteger(entry.start) || entry.end < entry.start) {
            errors.push(`preserve.ordinalRuns[${index}].end must be an integer not less than start.`);
          }
          if (entry.id != null && typeof entry.id !== "string") {
            errors.push(`preserve.ordinalRuns[${index}].id must be a string when present.`);
          }
        });
      }
    }
  }

  if (isPlainObject(requireBlock)) {
    for (const key of unknownKeys(requireBlock, REQUIRE_KEYS)) errors.push(`Unknown require key: ${key}`);
    if (requireBlock.headings != null) {
      if (!Array.isArray(requireBlock.headings) || requireBlock.headings.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
        errors.push("require.headings must be an array of non-empty strings.");
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    declaration: {
      version: 1,
      sourceSha256: value.sourceSha256.toLowerCase(),
      preserve: {
        headings: [...(preserve.headings ?? [])],
        recordRuns: (preserve.recordRuns ?? []).map((entry) => ({ ...entry })),
        ordinalRuns: (preserve.ordinalRuns ?? []).map((entry) => ({ ...entry })),
      },
      require: {
        headings: [...(requireBlock.headings ?? [])],
      },
    },
  };
}

function headingsOf(text) {
  const { tree } = parseMarkdown(text);
  const headings = [];
  visit(tree, "heading", (node) => {
    headings.push(normaliseHeading(plainText(node)));
  });
  return headings;
}

function findSection(text, sectionHeading) {
  const { tree } = parseMarkdown(text);
  const headings = [];
  visit(tree, "heading", (node) => {
    headings.push({
      node,
      depth: node.depth,
      normalised: normaliseHeading(plainText(node)),
    });
  });
  const wanted = normaliseHeading(sectionHeading);
  const index = headings.findIndex((heading) => heading.normalised === wanted);
  if (index === -1) return null;
  const target = headings[index];
  let endOffset = text.length;
  for (let cursor = index + 1; cursor < headings.length; cursor += 1) {
    if (headings[cursor].depth <= target.depth) {
      endOffset = headings[cursor].node.position?.start?.offset ?? endOffset;
      break;
    }
  }
  const startOffset = target.node.position?.end?.offset ?? 0;
  return { startOffset, endOffset };
}

function sectionRecordRuns(text, sectionHeading) {
  const section = findSection(text, sectionHeading);
  if (section == null) return null;
  const slice = text.slice(section.startOffset, section.endOffset);
  return detectRecordRuns(slice);
}

function sectionRecordCount(text, sectionHeading) {
  const runs = sectionRecordRuns(text, sectionHeading);
  return runs == null ? null : runs.reduce((sum, run) => sum + run.count, 0);
}

function isContiguousSubsequence(values, expected) {
  if (expected.length === 0) return true;
  for (let start = 0; start + expected.length <= values.length; start += 1) {
    let match = true;
    for (let offset = 0; offset < expected.length; offset += 1) {
      if (values[start + offset] !== expected[offset]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

// A declared invariant covers only its declared positions: trim a grounded
// run to that range so unrelated changes elsewhere in a longer list do not
// fail the declared requirement.
function trimRunToRange(run, start, end) {
  const items = run.items.filter((item) => item.position >= start && item.position <= end);
  return { ...run, start, count: items.length, items };
}

export function checkInvariants({ declaration, sourceText, candidateText }) {
  const issues = [];
  const warnings = [];
  const evidence = {
    sourceSha256: declaration.sourceSha256,
    sourceMatched: false,
    preserved: 0,
    required: 0,
  };

  if (hashText(sourceText).toLowerCase() !== declaration.sourceSha256) {
    issues.push(
      createIssue(
        "invariants",
        "Declared invariants were written for a different source snapshot (SHA-256 mismatch); re-derive the declaration from the current snapshot.",
      ),
    );
    return { ok: false, issues, warnings, evidence };
  }
  evidence.sourceMatched = true;

  const sourceHeadings = headingsOf(sourceText);
  const candidateHeadings = headingsOf(candidateText);

  for (const heading of declaration.preserve.headings) {
    evidence.preserved += 1;
    const wanted = normaliseHeading(heading);
    if (!sourceHeadings.includes(wanted)) {
      issues.push(
        createIssue(
          "invariants",
          `Declared invariant is not source-grounded: heading "${heading}" was not found in the source snapshot.`,
        ),
      );
    } else if (!candidateHeadings.includes(wanted)) {
      issues.push(createIssue("invariants", `Preserved heading is missing from the candidate: "${heading}".`));
    }
  }

  for (const requirement of declaration.preserve.recordRuns) {
    evidence.preserved += 1;
    const sourceRuns = sectionRecordRuns(sourceText, requirement.section);
    if (sourceRuns == null) {
      issues.push(
        createIssue(
          "invariants",
          `Declared invariant is not source-grounded: section "${requirement.section}" was not found in the source snapshot.`,
        ),
      );
      continue;
    }
    const sourceCount = sourceRuns.reduce((sum, run) => sum + run.count, 0);
    if (sourceCount !== requirement.count) {
      issues.push(
        createIssue(
          "invariants",
          `Declared record count for "${requirement.section}" does not match the source: declared ${requirement.count}, found ${sourceCount}.`,
        ),
      );
      continue;
    }
    const candidateCount = sectionRecordCount(candidateText, requirement.section);
    if (candidateCount == null) {
      issues.push(createIssue("invariants", `Declared section is missing from the candidate: "${requirement.section}".`));
    } else if (candidateCount < requirement.count) {
      issues.push(
        createIssue(
          "invariants",
          `Declared records are not preserved in "${requirement.section}": expected at least ${requirement.count} records on their own lines, found ${candidateCount}.`,
        ),
      );
    }
    // Records are compared by identity, order and line boundaries — not only
    // by the candidate's record count.
    const boundary = checkRecordPreservation(sourceText, candidateText, { runs: sourceRuns });
    issues.push(...boundary.issues);
  }

  for (const requirement of declaration.preserve.ordinalRuns) {
    evidence.preserved += 1;
    const wanted = normaliseHeading(requirement.section);
    const sourceRuns = extractOrdinalRuns(sourceText).filter((run) =>
      run.context.some((entry) => entry.normalised === wanted),
    );
    const expected = [];
    for (let value = requirement.start; value <= requirement.end; value += 1) expected.push(value);
    const grounded = sourceRuns
      .filter((run) => {
        const values = [];
        for (let index = 0; index < run.count; index += 1) values.push(run.start + index);
        return isContiguousSubsequence(values, expected);
      })
      .map((run) => trimRunToRange(run, requirement.start, requirement.end))
      .filter((run) => run.items.length > 0);
    if (grounded.length === 0) {
      issues.push(
        createIssue(
          "invariants",
          `Declared invariant is not source-grounded: no ordered sequence ${requirement.start}–${requirement.end} was found in section "${requirement.section}" of the source snapshot.`,
        ),
      );
      continue;
    }
    const result = checkOrdinalPreservation(sourceText, candidateText, { runs: grounded });
    issues.push(...result.issues);
    warnings.push(...result.warnings);
  }

  for (const heading of declaration.require.headings) {
    evidence.required += 1;
    const wanted = normaliseHeading(heading);
    if (!candidateHeadings.includes(wanted)) {
      issues.push(createIssue("invariants", `Required heading is missing from the candidate: "${heading}".`));
    }
  }

  return { ok: issues.length === 0, issues, warnings, evidence };
}
