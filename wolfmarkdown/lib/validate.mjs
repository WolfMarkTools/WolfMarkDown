import { lint as markdownlintSync } from "markdownlint/sync";
import { parse as parseYaml } from "yaml";
import { visit } from "unist-util-visit";
import { assertFencesBalanced, lineFenceStates } from "./fences.mjs";
import { formatMarkdown } from "./format.mjs";
import { compareTokens, extractTokens, integrityCoverage } from "./integrity.mjs";
import { createIssue } from "./issues.mjs";
import { parseMarkdown } from "./parse.mjs";
import { loadMarkdownlintConfig } from "./paths.mjs";

const DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const NON_TABLE_PIPE = /^(?:[-*+]|\d{1,9}[.)])\s|^>|^#{1,6}\s/;

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

function sourceTableIssues(text) {
  const { lines, inside } = lineFenceStates(text);
  const issues = [];
  let block = [];

  const flush = () => {
    if (block.length === 0) return;
    const hasDelimiter = block.some((entry) => DELIMITER.test(entry.line));
    if (block.length >= 2 || hasDelimiter) {
      const counts = block.filter((entry) => !DELIMITER.test(entry.line)).map((entry) => cells(entry.line).length);
      const line = block[0].number;
      if (!hasDelimiter) {
        issues.push(
          createIssue("tables", `Table-like block starting on line ${line} is missing a delimiter row.`, { line }),
        );
      }
      if (counts.length > 0 && counts.some((count) => count !== counts[0])) {
        issues.push(createIssue("tables", `Table starting on line ${line} has inconsistent cell counts.`, { line }));
      }
    }
    block = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (inside[index] || !line.includes("|") || NON_TABLE_PIPE.test(line.trimStart())) {
      flush();
      continue;
    }
    block.push({ line, number: index + 1 });
  }
  flush();
  return issues;
}

function headingIssues(tree) {
  const issues = [];
  let previous = null;
  visit(tree, "heading", (node) => {
    if (previous != null && node.depth > previous + 1) {
      issues.push(
        createIssue("headings", `Heading level skips from h${previous} to h${node.depth}.`, {
          line: node.position?.start?.line ?? null,
        }),
      );
    }
    previous = node.depth;
  });
  return issues;
}

function astTableIssues(tree) {
  const issues = [];
  visit(tree, "table", (node) => {
    const counts = node.children.map((row) => row.children.length);
    if (counts.some((count) => count !== counts[0])) {
      issues.push(
        createIssue("tables", "GFM table has inconsistent cell counts.", { line: node.position?.start?.line ?? null }),
      );
    }
  });
  return issues;
}

function frontmatterIssues(text) {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return [];
  const rest = text.startsWith("---\r\n") ? text.slice(5) : text.slice(4);
  const closer = rest.search(/\r?\n---(?:\r?\n|$)/);
  if (closer === -1) return [createIssue("frontmatter", "YAML frontmatter is not closed.")];
  try {
    parseYaml(rest.slice(0, closer));
  } catch (error) {
    return [createIssue("frontmatter", `YAML frontmatter does not parse: ${error.message}`)];
  }
  return [];
}

function whitespaceIssues(text) {
  const issues = [];
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    const trailing = line.match(/[ \t]+$/u);
    if (trailing && trailing[0] !== "  ") {
      issues.push(createIssue("whitespace", `Trailing whitespace on line ${index + 1}.`, { line: index + 1 }));
    }
  });
  if (/\n{4,}/u.test(text)) {
    issues.push(createIssue("whitespace", "Document contains three or more consecutive blank lines."));
  }
  if (!text.endsWith("\n")) {
    issues.push(createIssue("whitespace", "Document must end with exactly one newline."));
  } else if (text.endsWith("\n\n")) {
    issues.push(createIssue("whitespace", "Document must end with exactly one newline."));
  }
  return issues;
}

function markdownlintIssues(text) {
  const report = markdownlintSync({
    strings: { document: text },
    config: loadMarkdownlintConfig(),
    resultVersion: 3,
  });
  const findings = report.document ?? [];
  return findings.map((item) =>
    createIssue("markdownlint", `markdownlint ${item.ruleNames[0]} on line ${item.lineNumber}: ${item.ruleDescription}`, {
      line: item.lineNumber,
    }),
  );
}

function elapsedMs(started) {
  return Math.round(performance.now() - started);
}

export async function verifyMarkdown(text, { integrityFromText } = {}) {
  const started = performance.now();
  const timings = {};
  const checks = {
    parse: false,
    prettier: false,
    markdownlint: false,
    headings: false,
    tables: false,
    fences: false,
    frontmatter: false,
    whitespace: false,
    integrity: integrityFromText == null ? null : false,
    idempotence: false,
  };
  const issues = [];

  const parseStarted = performance.now();
  try {
    const { tree } = parseMarkdown(text);
    checks.parse = true;
    const heading = headingIssues(tree);
    const tables = [...astTableIssues(tree), ...sourceTableIssues(text)];
    checks.headings = heading.length === 0;
    checks.tables = tables.length === 0;
    issues.push(...heading, ...tables);
  } catch (error) {
    issues.push(createIssue("parse", `Markdown did not parse: ${error.message}`));
  }
  timings.parseMs = elapsedMs(parseStarted);

  const fences = assertFencesBalanced(text);
  checks.fences = fences.ok;
  if (!fences.ok) {
    issues.push(createIssue("fences", fences.message, { line: fences.openLine }));
  }

  const frontmatter = frontmatterIssues(text);
  checks.frontmatter = frontmatter.length === 0;
  issues.push(...frontmatter);

  const whitespace = whitespaceIssues(text);
  checks.whitespace = whitespace.length === 0;
  issues.push(...whitespace);

  const prettierStarted = performance.now();
  const formatted = await formatMarkdown(text);
  checks.prettier = formatted === text;
  if (!checks.prettier) issues.push(createIssue("prettier", "Prettier formatting check failed."));
  timings.prettierMs = elapsedMs(prettierStarted);

  const lintStarted = performance.now();
  const lint = markdownlintIssues(text);
  checks.markdownlint = lint.length === 0;
  issues.push(...lint);
  timings.markdownlintMs = elapsedMs(lintStarted);

  const twice = await formatMarkdown(formatted);
  checks.idempotence = twice === formatted;
  if (!checks.idempotence) issues.push(createIssue("idempotence", "Formatter is not idempotent."));

  const coverageSource = integrityFromText ?? text;
  if (integrityFromText != null) {
    const integrityStarted = performance.now();
    const comparison = compareTokens(extractTokens(integrityFromText), text);
    checks.integrity = comparison.ok;
    for (const token of comparison.missing) {
      issues.push(createIssue("integrity", `Protected token missing: ${token}`));
    }
    timings.integrityMs = elapsedMs(integrityStarted);
  }

  timings.totalMs = elapsedMs(started);
  const errors = issues.map((issue) => issue.message);
  return {
    ok: issues.length === 0,
    checks,
    errors,
    issues,
    integrityCoverage: integrityCoverage(coverageSource, { checked: integrityFromText != null }),
    timings,
  };
}
