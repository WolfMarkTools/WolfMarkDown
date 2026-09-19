import { visit } from "unist-util-visit";
import { lineFenceStates } from "./fences.mjs";
import { integrityCoverage } from "./integrity.mjs";
import { parseMarkdown } from "./parse.mjs";
import { hashText } from "./report.mjs";

export const SCAFFOLD_NOTE =
  "This scaffold inventories source facts. It does not decide semantic structure or rewrite the document.";

const DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const LIST_LIKE = /^(?:[-*+]|\d{1,9}[.)])\s|^>|^#{1,6}\s/;

function plainText(node) {
  if (!node) return "";
  if (node.type === "text") return node.value;
  if (!node.children) return "";
  return node.children.map((child) => plainText(child)).join("");
}

function loc(node) {
  return {
    line: node.position?.start?.line ?? null,
    endLine: node.position?.end?.line ?? null,
    startOffset: node.position?.start?.offset ?? null,
    endOffset: node.position?.end?.offset ?? null,
  };
}

function pipeRuns(text) {
  const { lines, inside } = lineFenceStates(text);
  const runs = [];
  let block = [];
  const flush = () => {
    if (block.length === 0) return;
    runs.push({
      startLine: block[0].number,
      endLine: block[block.length - 1].number,
      lineCount: block.length,
      hasDelimiter: block.some((entry) => DELIMITER.test(entry.line)),
      listLike: block.every((entry) => LIST_LIKE.test(entry.line.trimStart())),
    });
    block = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (inside[index] || !line.includes("|")) {
      flush();
      continue;
    }
    block.push({ line, number: index + 1 });
  }
  flush();
  return runs;
}

export function documentScaffold(text) {
  const { tree } = parseMarkdown(text);
  const headings = [];
  const fences = [];
  const lists = [];
  let gfmTables = 0;
  visit(tree, (node) => {
    if (node.type === "heading") {
      headings.push({ depth: node.depth, text: plainText(node).trim(), ...loc(node) });
    } else if (node.type === "code") {
      fences.push({ lang: node.lang ?? "", ...loc(node) });
    } else if (node.type === "list") {
      lists.push({ ordered: Boolean(node.ordered), itemCount: node.children?.length ?? 0, ...loc(node) });
    } else if (node.type === "table") {
      gfmTables += 1;
    }
  });
  const coverage = integrityCoverage(text, { checked: false });
  return {
    hash: hashText(text),
    bytes: Buffer.byteLength(text, "utf8"),
    lineCount: text.split("\n").length,
    headings,
    fences,
    lists,
    gfmTables,
    pipeRuns: pipeRuns(text),
    tokens: coverage.classes,
    note: SCAFFOLD_NOTE,
  };
}
