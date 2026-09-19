import { visit } from "unist-util-visit";
import { parseMarkdown } from "./parse.mjs";

const URL_RE = /https?:\/\/[^\s)<>"']+/g;
const VERSION_RE = /\bv?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/g;
const HEX_RE = /\b[0-9a-fA-F]{40,}\b/g;
const BASE58_SIG_RE = /\b[1-9A-HJ-NP-Za-km-z]{80,90}\b/g;
const BASE58_KEY_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const UK_DATE_RE = /\b\d{2}\/\d{2}\/\d{4}\b/g;
const PERCENT_RE = /\b\d+(?:\.\d+)?%/g;
const CURRENCY_RE = /[\$£€]\d+(?:\.\d{2})?/g;
const ENV_SCOPED_RE = /\$\{([A-Z][A-Z0-9_]{2,})\}|\$([A-Z][A-Z0-9_]{2,})\b/g;
const ENV_ASSIGN_RE = /\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)=/g;
const ENV_NAME_RE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g;
const CAMEL_IDENT_RE = /\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g;
const SNAKE_IDENT_RE = /\b[a-z]+(?:_[a-z0-9]+)+\b/g;
const HOME_OR_REL_PATH_RE = /(?:~|\.{1,2})\/[^\s)`'"]+/g;
const ABS_PATH_RE = /(?:^|[\s(`])(\/(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+)/g;
const WIN_ABS_PATH_RE = /(?:^|[\s(`])([A-Za-z]:\\[^\s)`'"]+)/g;
const WIN_FWD_PATH_RE = /(?:^|[\s(`])([A-Za-z]:\/(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+)/g;
const TWO_PART_VERSION_RE = /(?<![\d.])v?\d+\.\d+(?!\.\d)/g;
const MONTH_NAME_DATE_RE =
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g;

export const TOKEN_CLASS_NAMES = [
  "url",
  "inlineCode",
  "fencedCode",
  "semver",
  "hex",
  "base58",
  "isoDate",
  "numericDate",
  "percent",
  "currency",
  "path",
  "env",
  "camelCase",
  "snakeCase",
];

function emptyClasses() {
  return Object.fromEntries(TOKEN_CLASS_NAMES.map((name) => [name, new Set()]));
}

function cleanToken(value) {
  return value?.replace(/[.,;:]+$/u, "") ?? "";
}

function add(index, className, value) {
  const token = cleanToken(value);
  if (!token) return;
  index.tokens.add(token);
  index.classes[className].add(token);
}

function addAll(index, text, pattern, className, pick = (match) => match[0]) {
  for (const match of text.matchAll(pattern)) add(index, className, pick(match));
}

export function extractFromText(text, tokens = new Set()) {
  const index = { tokens, classes: emptyClasses() };
  extractRegexClasses(index, text);
  return tokens;
}

function extractRegexClasses(index, text) {
  addAll(index, text, URL_RE, "url");
  addAll(index, text, VERSION_RE, "semver");
  addAll(index, text, HEX_RE, "hex");
  addAll(index, text, BASE58_SIG_RE, "base58");
  addAll(index, text, BASE58_KEY_RE, "base58");
  addAll(index, text, ISO_DATE_RE, "isoDate");
  addAll(index, text, UK_DATE_RE, "numericDate");
  addAll(index, text, PERCENT_RE, "percent");
  addAll(index, text, CURRENCY_RE, "currency");
  addAll(index, text, HOME_OR_REL_PATH_RE, "path");
  addAll(index, text, ABS_PATH_RE, "path", (match) => match[1]);
  addAll(index, text, WIN_ABS_PATH_RE, "path", (match) => match[1]);
  addAll(index, text, WIN_FWD_PATH_RE, "path", (match) => match[1]);
  addAll(index, text, ENV_SCOPED_RE, "env", (match) => match[1] || match[2]);
  addAll(index, text, ENV_ASSIGN_RE, "env", (match) => match[1]);
  addAll(index, text, ENV_NAME_RE, "env");
  addAll(index, text, CAMEL_IDENT_RE, "camelCase");
  addAll(index, text, SNAKE_IDENT_RE, "snakeCase");
}

export function extractTokenIndex(text) {
  const index = { tokens: new Set(), classes: emptyClasses() };
  const { tree } = parseMarkdown(text);
  visit(tree, (node) => {
    if (node.type === "inlineCode" && node.value) {
      add(index, "inlineCode", node.value);
      extractRegexClasses(index, node.value);
    } else if (node.type === "code" && node.value) {
      add(index, "fencedCode", node.value.replace(/\n$/u, ""));
      extractRegexClasses(index, node.value);
    } else if (node.type === "link" && node.url) {
      add(index, "url", node.url);
    } else if (node.type === "text" && node.value) {
      extractRegexClasses(index, node.value);
    }
  });
  extractRegexClasses(index, text);
  return index;
}

export function extractTokens(text) {
  return extractTokenIndex(text).tokens;
}

export function compareTokens(before, after) {
  const afterSet = after instanceof Set ? after : extractTokens(after);
  const missing = [];
  for (const token of before) {
    if (!afterSet.has(token)) missing.push(token);
  }
  return { missing, ok: missing.length === 0 };
}

function uniqueMatches(text, pattern) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0]))];
}

export function integrityCoverage(text, { checked = false } = {}) {
  const index = extractTokenIndex(text);
  const classes = Object.fromEntries(
    TOKEN_CLASS_NAMES.map((name) => {
      const values = [...index.classes[name]];
      return [name, { count: values.length, examples: values.slice(0, 3) }];
    }),
  );
  const twoPart = uniqueMatches(text, TWO_PART_VERSION_RE);
  const monthDates = uniqueMatches(text, MONTH_NAME_DATE_RE);
  const warnings = [
    {
      code: "unprotected-isolated-integer",
      message: "Isolated integers are not a protected-token class and can change without failing integrity.",
      examples: [],
    },
  ];
  if (twoPart.length > 0) {
    warnings.push({
      code: "unprotected-two-part-version",
      message: "Two-part versions such as 18.17 are outside the current extractor.",
      examples: twoPart.slice(0, 3),
    });
  }
  if (monthDates.length > 0) {
    warnings.push({
      code: "unprotected-month-name-date",
      message: "Month-name dates such as May 2027 are outside the current extractor.",
      examples: monthDates.slice(0, 3),
    });
  }
  return { checked, classes, warnings };
}
