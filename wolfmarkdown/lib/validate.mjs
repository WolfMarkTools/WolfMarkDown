import { lint as markdownlintSync } from "markdownlint/sync";
import { parse as parseYaml } from "yaml";
import { visit } from "unist-util-visit";
import { assertFencesBalanced, lineFenceStates } from "./fences.mjs";
import { formatMarkdown } from "./format.mjs";
import { compareTokens, extractTokens } from "./integrity.mjs";
import { parseMarkdown } from "./parse.mjs";
import { loadMarkdownlintConfig } from "./paths.mjs";

const DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/;

function splitUnescapedPipes(text) {
  const parts = [];
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "|") {
      current += text[index];
      continue;
    }
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) slashes += 1;
    if (slashes % 2 === 1) {
      current += "|";
      continue;
    }
    parts.push(current);
    current = "";
  }
  parts.push(current);
  return parts;
}

export function cells(line) {
  const trimmed = line.trim();
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutEnd = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return splitUnescapedPipes(withoutEnd).map((cell) => cell.trim());
}

function sourceTableErrors(text) {
  const { lines, inside } = lineFenceStates(text);
  const errors = [];
  let block = [];

  const flush = () => {
    if (block.length === 0) return;
    const hasDelimiter = block.some((entry) => DELIMITER.test(entry.line));
    if (block.length >= 2 || hasDelimiter) {
      const counts = block.filter((entry) => !DELIMITER.test(entry.line)).map((entry) => cells(entry.line).length);
      if (!hasDelimiter) {
        errors.push(`Table-like block starting on line ${block[0].number} is missing a delimiter row.`);
      }
      if (counts.length > 0 && counts.some((count) => count !== counts[0])) {
        errors.push(`Table starting on line ${block[0].number} has inconsistent cell counts.`);
      }
    }
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
  return errors;
}

function headingErrors(tree) {
  const errors = [];
  let previous = null;
  visit(tree, "heading", (node) => {
    if (previous != null && node.depth > previous + 1) {
      errors.push(`Heading level skips from h${previous} to h${node.depth}.`);
    }
    previous = node.depth;
  });
  return errors;
}

function astTableErrors(tree) {
  const errors = [];
  visit(tree, "table", (node) => {
    const counts = node.children.map((row) => row.children.length);
    if (counts.some((count) => count !== counts[0])) {
      errors.push("GFM table has inconsistent cell counts.");
    }
  });
  return errors;
}

function frontmatterErrors(text) {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return [];
  const rest = text.startsWith("---\r\n") ? text.slice(5) : text.slice(4);
  const closer = rest.search(/\r?\n---(?:\r?\n|$)/);
  if (closer === -1) return ["YAML frontmatter is not closed."];
  try {
    parseYaml(rest.slice(0, closer));
  } catch (error) {
    return [`YAML frontmatter does not parse: ${error.message}`];
  }
  return [];
}

function whitespaceErrors(text) {
  const errors = [];
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (/[ \t]+$/u.test(line)) {
      errors.push(`Trailing whitespace on line ${index + 1}.`);
    }
  });
  if (/\n{4,}/u.test(text)) {
    errors.push("Document contains three or more consecutive blank lines.");
  }
  if (!text.endsWith("\n")) {
    errors.push("Document must end with exactly one newline.");
  } else if (text.endsWith("\n\n")) {
    errors.push("Document must end with exactly one newline.");
  }
  return errors;
}

function markdownlintErrors(text) {
  const report = markdownlintSync({
    strings: { document: text },
    config: loadMarkdownlintConfig(),
    resultVersion: 3,
  });
  const findings = report.document ?? [];
  return findings.map((item) => `markdownlint ${item.ruleNames[0]} on line ${item.lineNumber}: ${item.ruleDescription}`);
}

export async function verifyMarkdown(text, { integrityFromText } = {}) {
  const checks = {
    parse: false,
    prettier: false,
    markdownlint: false,
    headings: false,
    tables: false,
    fences: false,
    frontmatter: false,
    whitespace: false,
    integrity: integrityFromText == null,
    idempotence: false,
  };
  const errors = [];

  try {
    const { tree } = parseMarkdown(text);
    checks.parse = true;
    const heading = headingErrors(tree);
    const tables = [...astTableErrors(tree), ...sourceTableErrors(text)];
    checks.headings = heading.length === 0;
    checks.tables = tables.length === 0;
    errors.push(...heading, ...tables);
  } catch (error) {
    errors.push(`Markdown did not parse: ${error.message}`);
  }

  const fences = assertFencesBalanced(text);
  checks.fences = fences.ok;
  errors.push(...fences.errors);

  const frontmatter = frontmatterErrors(text);
  checks.frontmatter = frontmatter.length === 0;
  errors.push(...frontmatter);

  const whitespace = whitespaceErrors(text);
  checks.whitespace = whitespace.length === 0;
  errors.push(...whitespace);

  const formatted = await formatMarkdown(text);
  checks.prettier = formatted === text;
  if (!checks.prettier) errors.push("Prettier formatting check failed.");

  const lint = markdownlintErrors(text);
  checks.markdownlint = lint.length === 0;
  errors.push(...lint);

  const twice = await formatMarkdown(formatted);
  checks.idempotence = twice === formatted;
  if (!checks.idempotence) errors.push("Formatter is not idempotent.");

  if (integrityFromText != null) {
    const comparison = compareTokens(extractTokens(integrityFromText), text);
    checks.integrity = comparison.ok;
    for (const token of comparison.missing) {
      errors.push(`Protected token missing: ${token}`);
    }
  }

  return { ok: errors.length === 0, checks, errors };
}
