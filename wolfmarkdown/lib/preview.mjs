import { lineFenceStates } from "./fences.mjs";
import { formatMarkdown } from "./format.mjs";
import { compareTokens, extractTokens } from "./integrity.mjs";
import { documentScaffold } from "./scaffold.mjs";

const SCAFFOLDING = [
  /^(?:User|Assistant|Codex|Agent|Gemini|Claude|Grok):\s/gmu,
  /\bSure, here's\b/giu,
  /\bLet me know if\b/giu,
  /\bAs we discussed\b/giu,
  /\bYou asked about\b/giu,
  /\bHope that helps\b/giu,
];

export const PREVIEW_NOTE =
  "Preview reports observable differences. It does not judge whether a semantic decision was correct.";

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function scaffoldingCount(text) {
  const { lines, inside } = lineFenceStates(text);
  const visible = lines.filter((_, index) => !inside[index]).join("\n");
  return SCAFFOLDING.reduce((sum, pattern) => sum + countMatches(visible, pattern), 0);
}

export async function previewDocuments(sourceText, candidateText, { destination = null } = {}) {
  const source = documentScaffold(sourceText);
  const candidate = documentScaffold(candidateText);
  const formattedSource = await formatMarkdown(sourceText);
  const tokens = compareTokens(extractTokens(sourceText), candidateText);
  return {
    destination,
    unchanged: sourceText === candidateText,
    formattingOnly: sourceText !== candidateText && formattedSource === candidateText,
    lines: { source: source.lineCount, candidate: candidate.lineCount },
    structure: {
      headings: { source: source.headings.length, candidate: candidate.headings.length },
      tables: { source: source.gfmTables, candidate: candidate.gfmTables },
      lists: { source: source.lists.length, candidate: candidate.lists.length },
      fences: { source: source.fences.length, candidate: candidate.fences.length },
    },
    scaffolding: { source: scaffoldingCount(sourceText), candidate: scaffoldingCount(candidateText) },
    protectedTokens: { missing: tokens.missing, preserved: tokens.ok },
    note: PREVIEW_NOTE,
  };
}
