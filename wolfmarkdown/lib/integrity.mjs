import { visit } from "unist-util-visit";
import { parseMarkdown } from "./parse.mjs";

const URL_RE = /https?:\/\/[^\s)<>"']+/g;
const VERSION_RE = /\bv?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/g;
const HEX_RE = /\b[0-9a-fA-F]{40,}\b/g;
const BASE58_SIG_RE = /\b[1-9A-HJ-NP-Za-km-z]{80,90}\b/g;
const BASE58_KEY_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const UK_DATE_RE = /\b\d{2}\/\d{2}\/\d{4}\b/g;
const PERCENT_RE = /\b\d+(?:\.\d+)? ?%/g;
const CURRENCY_RE = /[$£€]\d[\d,]*(?:\.\d+)?/g;
const ENV_SCOPED_RE = /\$\{([A-Z][A-Z0-9_]{2,})\}|\$([A-Z][A-Z0-9_]{2,})\b/g;
const ENV_ASSIGN_RE = /\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)=/g;
const ENV_NAME_RE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g;
const CAMEL_IDENT_RE = /\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g;
const SNAKE_IDENT_RE = /\b[a-z]+(?:_[a-z0-9]+)+\b/g;
const HOME_OR_REL_PATH_RE = /(?:~|\.{1,2})\/[^\s)`'"]+/g;
const REL_FILE_PATH_RE = /\b(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+\.[A-Za-z0-9]{1,10}\b/g;
const MULTI_SEGMENT_PATH_RE = /\b(?:[A-Za-z0-9._-]+\/){2,}[A-Za-z0-9._-]+\/?/g;
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
  return Object.fromEntries(TOKEN_CLASS_NAMES.map((name) => [name, new Map()]));
}

function countUp(map, token) {
  map.set(token, (map.get(token) ?? 0) + 1);
}

function cleanToken(value) {
  return value?.replace(/[.,;:]+$/u, "") ?? "";
}

function addExact(index, className, value) {
  if (!value) return;
  index.tokens.add(value);
  countUp(index.classes[className], value);
}

function add(index, className, value, inCode = false) {
  const token = cleanToken(value);
  if (!token) return;
  index.tokens.add(token);
  countUp(index.classes[className], token);
  if (inCode) index.codeTokens.add(token);
}

function addAll(index, text, pattern, className, options = {}) {
  const { pick = (match) => match[0], normalize = (token) => token, code = false } = typeof options === "function" ? { pick: options } : options;
  for (const match of text.matchAll(pattern)) {
    const token = cleanToken(normalize(pick(match)));
    if (!token) continue;
    index.tokens.add(token);
    countUp(index.classes[className], token);
    if (code) index.codeTokens.add(token);
  }
}

export function extractFromText(text, tokens = new Set()) {
  const index = { tokens, classes: emptyClasses() };
  extractRegexClasses(index, text);
  return tokens;
}

function extractRegexClasses(index, text, inCode = false) {
  addAll(index, text, URL_RE, "url", { code: inCode });
  addAll(index, text, VERSION_RE, "semver", { code: inCode });
  addAll(index, text, HEX_RE, "hex", { code: inCode });
  addAll(index, text, BASE58_SIG_RE, "base58", { code: inCode });
  addAll(index, text, BASE58_KEY_RE, "base58", { code: inCode });
  addAll(index, text, ISO_DATE_RE, "isoDate", { code: inCode });
  addAll(index, text, UK_DATE_RE, "numericDate", { code: inCode });
  addAll(index, text, PERCENT_RE, "percent", { normalize: (token) => token.replace(/\s+/gu, ""), code: inCode });
  addAll(index, text, CURRENCY_RE, "currency", { code: inCode });
  addAll(index, text, HOME_OR_REL_PATH_RE, "path", { code: inCode });
  addAll(index, text, REL_FILE_PATH_RE, "path", { code: inCode });
  addAll(index, text, MULTI_SEGMENT_PATH_RE, "path", { code: inCode });
  addAll(index, text, ABS_PATH_RE, "path", { pick: (match) => match[1], code: inCode });
  addAll(index, text, WIN_ABS_PATH_RE, "path", { pick: (match) => match[1], code: inCode });
  addAll(index, text, WIN_FWD_PATH_RE, "path", { pick: (match) => match[1], code: inCode });
  addAll(index, text, ENV_SCOPED_RE, "env", { pick: (match) => match[0], code: inCode });
  addAll(index, text, ENV_ASSIGN_RE, "env", { pick: (match) => match[1], code: inCode });
  addAll(index, text, ENV_NAME_RE, "env", { code: inCode });
  addAll(index, text, CAMEL_IDENT_RE, "camelCase", { code: inCode });
  addAll(index, text, SNAKE_IDENT_RE, "snakeCase", { code: inCode });
}

const ALWAYS_STRONG_CLASSES = new Set([
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
]);

const PROSE_WEAK_CLASSES = ["camelCase", "snakeCase", "env"];

function assignStrength(index) {
  for (const [name, map] of Object.entries(index.classes)) {
    for (const token of map.keys()) {
      if (ALWAYS_STRONG_CLASSES.has(name)) {
        index.strong.add(token);
      } else if (name === "env") {
        if (token.startsWith("$") || index.codeTokens.has(token)) index.strong.add(token);
      } else if (index.codeTokens.has(token)) {
        index.strong.add(token);
      }
    }
  }
}

export function extractTokenIndex(text) {
  const index = { tokens: new Set(), classes: emptyClasses(), codeTokens: new Set(), strong: new Set() };
  const { tree } = parseMarkdown(text);
  visit(tree, (node) => {
    if (node.type === "inlineCode" && node.value) {
      addExact(index, "inlineCode", node.value);
      addExact(index, "inlineCode", `\`${node.value}\``);
      extractRegexClasses(index, node.value, true);
    } else if (node.type === "code" && node.value) {
      addExact(index, "fencedCode", node.value.replace(/\n$/u, ""));
      extractRegexClasses(index, node.value, true);
    } else if (node.type === "link" && node.url) {
      addExact(index, "url", node.url);
    } else if (node.type === "text" && node.value) {
      extractRegexClasses(index, node.value, false);
    }
  });
  extractRegexClasses(index, text, false);
  assignStrength(index);
  return index;
}

export function extractTokens(text) {
  return extractTokenIndex(text).tokens;
}

export function tokenCount(index, token) {
  let total = 0;
  for (const map of Object.values(index.classes)) total += map.get(token) ?? 0;
  return total;
}

export function weakTokens(index) {
  const weak = new Set();
  for (const name of PROSE_WEAK_CLASSES) {
    for (const token of index.classes[name].keys()) {
      if (!index.strong.has(token)) weak.add(token);
    }
  }
  return weak;
}

export function tokenClass(index, token) {
  for (const [name, map] of Object.entries(index.classes)) {
    if (map.has(token)) return name;
  }
  return null;
}

export function compareTokenIndexes(before, after) {
  const missing = [];
  for (const token of before.strong) {
    if (!after.tokens.has(token)) missing.push(token);
  }
  const weakMissing = [];
  for (const token of weakTokens(before)) {
    if (!after.tokens.has(token)) weakMissing.push(token);
  }
  const decreased = [];
  for (const token of before.strong) {
    const beforeCount = tokenCount(before, token);
    const afterCount = tokenCount(after, token);
    if (afterCount > 0 && afterCount < beforeCount) decreased.push({ token, before: beforeCount, after: afterCount });
  }
  // A decreased token alongside a newly appearing token of the same class
  // reads as an unauthorised change rather than consolidation, so it fails.
  const gainedByClass = new Map();
  for (const token of after.strong) {
    if (before.tokens.has(token)) continue;
    const name = tokenClass(after, token) ?? "unknown";
    if (!gainedByClass.has(name)) gainedByClass.set(name, []);
    gainedByClass.get(name).push(token);
  }
  for (const list of gainedByClass.values()) list.sort();
  const mutated = [];
  const remainingDecreased = [];
  for (const entry of decreased) {
    const name = tokenClass(before, entry.token);
    const gained = name ? (gainedByClass.get(name) ?? []) : [];
    if (gained.length > 0) mutated.push({ token: entry.token, changedTo: gained.shift(), class: name });
    else remainingDecreased.push(entry);
  }
  return { missing, mutated, weakMissing, decreased: remainingDecreased, ok: missing.length === 0 && mutated.length === 0 };
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
      const values = [...index.classes[name].keys()];
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
