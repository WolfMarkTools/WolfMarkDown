import { visit } from "unist-util-visit";
import { compareTokens, extractTokens } from "./integrity.mjs";
import { parseMarkdown } from "./parse.mjs";

function nodeText(node) {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(nodeText).join("");
}

function collectStructures(candidateText) {
  const { tree } = parseMarkdown(candidateText);
  const headings = [];
  const tables = [];
  visit(tree, (node) => {
    if (node.type === "heading") headings.push(nodeText(node));
    if (node.type === "table") tables.push(nodeText(node));
  });
  return { headings, tables };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function lineHasToken(line, token) {
  const escaped = escapeRegExp(token);
  return new RegExp(`(?<![\\w.-])${escaped}(?![\\w.-])`, "u").test(line);
}

function nonEmptyLines(text) {
  return text.split(/\r?\n/u).flatMap((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return [];
    return [{ text: trimmed, lineNumber: index + 1 }];
  });
}

function recordTokens(record) {
  return (Array.isArray(record) ? record : [record]).map((token) => String(token)).filter(Boolean);
}

export function evaluateRecordBoundaries(candidateText, records = []) {
  const lines = nonEmptyLines(candidateText);
  const assigned = [];
  const errors = [];

  for (const record of records) {
    const tokens = recordTokens(record);
    if (tokens.length === 0) continue;
    let found = -1;
    for (const line of lines) {
      if (assigned.includes(line.lineNumber)) continue;
      if (tokens.every((token) => lineHasToken(line.text, token))) {
        found = line.lineNumber;
        break;
      }
    }
    const label = tokens.join(" ");
    if (found === -1) {
      errors.push(`Record does not survive on its own line: ${label}`);
      continue;
    }
    if (assigned.length > 0 && found <= assigned.at(-1)) {
      errors.push(`Record order or association was lost: ${label}`);
      continue;
    }
    assigned.push(found);
  }

  return { ok: errors.length === 0, assigned, errors };
}

export function evaluateSemanticProperties(sourceText, candidateText, properties = {}) {
  const { headings, tables } = collectStructures(candidateText);
  const errors = [];
  const expectedHeadings = properties.headings ?? [];
  const preservedText = properties.preserve ?? [];
  const forbiddenTableText = properties.forbidTableText ?? [];
  const expectedRecords = properties.preserveRecords ?? [];

  for (const heading of expectedHeadings) {
    if (!headings.includes(heading)) errors.push(`Expected heading not found: ${heading}`);
  }

  if (properties.minTables != null && tables.length < properties.minTables) {
    errors.push(`Expected at least ${properties.minTables} GFM tables, found ${tables.length}.`);
  }
  if (properties.maxTables != null && tables.length > properties.maxTables) {
    errors.push(`Expected at most ${properties.maxTables} GFM tables, found ${tables.length}.`);
  }

  for (const text of preservedText) {
    if (!candidateText.includes(text)) errors.push(`Required source text missing: ${text}`);
  }

  for (const text of forbiddenTableText) {
    if (tables.some((table) => table.includes(text))) {
      errors.push(`Ambiguous text was promoted into a table: ${text}`);
    }
  }

  const records = evaluateRecordBoundaries(candidateText, expectedRecords);
  errors.push(...records.errors);

  const integrity = compareTokens(extractTokens(sourceText), extractTokens(candidateText));
  for (const token of integrity.missing) errors.push(`Protected token missing: ${token}`);

  return {
    ok: errors.length === 0,
    checks: {
      headings: expectedHeadings.every((heading) => headings.includes(heading)),
      tables:
        (properties.minTables == null || tables.length >= properties.minTables) &&
        (properties.maxTables == null || tables.length <= properties.maxTables),
      preservation: preservedText.every((text) => candidateText.includes(text)),
      records: records.ok,
      integrity: integrity.ok,
      ambiguity: !forbiddenTableText.some((text) => tables.some((table) => table.includes(text))),
    },
    evidence: { headings, tableCount: tables.length, recordLines: records.assigned },
    errors,
  };
}
