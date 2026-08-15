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

export function evaluateSemanticProperties(sourceText, candidateText, properties = {}) {
  const { headings, tables } = collectStructures(candidateText);
  const errors = [];
  const expectedHeadings = properties.headings ?? [];
  const preservedText = properties.preserve ?? [];
  const forbiddenTableText = properties.forbidTableText ?? [];

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
      integrity: integrity.ok,
      ambiguity: !forbiddenTableText.some((text) => tables.some((table) => table.includes(text))),
    },
    evidence: { headings, tableCount: tables.length },
    errors,
  };
}
