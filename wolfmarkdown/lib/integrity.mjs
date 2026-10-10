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
const ENV_SCOPED_RE = /\$\{[A-Z][A-Z0-9_]{2,}\}|\$[A-Z][A-Z0-9_]{2,}\b/g;
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

function addPaths(index, text, inCode = false) {
  const patterns = [
    { pattern: HOME_OR_REL_PATH_RE, pick: (match) => match[0] },
    { pattern: REL_FILE_PATH_RE, pick: (match) => match[0] },
    { pattern: MULTI_SEGMENT_PATH_RE, pick: (match) => match[0] },
    { pattern: ABS_PATH_RE, pick: (match) => match[1] },
    { pattern: WIN_ABS_PATH_RE, pick: (match) => match[1] },
    { pattern: WIN_FWD_PATH_RE, pick: (match) => match[1] },
  ];
  // Several path patterns can match the identical source span (for example a
  // relative file path that is also multi-segment). Deduplicate by span so one
  // appearance counts once, while distinct appearances keep separate counts.
  const seen = new Set();
  for (const { pattern, pick } of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = pick(match);
      const token = cleanToken(raw);
      if (!token) continue;
      // Key on the cleaned token's span: patterns may include trailing
      // punctuation that cleanToken strips, and those must still collide.
      const start = match.index + match[0].lastIndexOf(raw);
      const key = `${start}:${start + token.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      index.tokens.add(token);
      countUp(index.classes.path, token);
      if (inCode) index.codeTokens.add(token);
    }
  }
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
  addPaths(index, text, inCode);
  addAll(index, text, ENV_SCOPED_RE, "env", { pick: (match) => match[0], code: inCode });
  addAll(index, text, ENV_ASSIGN_RE, "env", { pick: (match) => match[0], code: inCode });
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
        if (token.startsWith("$") || token.endsWith("=") || index.codeTokens.has(token)) index.strong.add(token);
      } else if (index.codeTokens.has(token)) {
        index.strong.add(token);
      }
    }
  }
}

export function extractTokenIndex(text) {
  const index = { tokens: new Set(), classes: emptyClasses(), codeTokens: new Set(), strong: new Set() };
  const { tree } = parseMarkdown(text);
  // Each text region is scanned exactly once so occurrence counts reflect
  // actual appearances rather than extraction matches.
  visit(tree, (node, _childIndex, parent) => {
    if (!node || typeof node.type !== "string") return;
    if ((node.type === "inlineCode" || node.type === "code") && typeof node.value === "string") {
      if (node.type === "inlineCode") {
        addExact(index, "inlineCode", node.value);
        addExact(index, "inlineCode", `\`${node.value}\``);
      } else {
        addExact(index, "fencedCode", node.value.replace(/\n$/u, ""));
      }
      extractRegexClasses(index, node.value, true);
      return;
    }
    if (
      (node.type === "link" || node.type === "definition" || node.type === "image" || node.type === "imageReference") &&
      (typeof node.url === "string" || typeof node.alt === "string")
    ) {
      if (typeof node.url === "string") addExact(index, "url", node.url);
      if (typeof node.title === "string" && node.title) extractRegexClasses(index, node.title, false);
      // Image descriptions live only in the alt property (no child nodes),
      // so they are scanned here, exactly once, as ordinary prose.
      if (
        (node.type === "image" || node.type === "imageReference") &&
        typeof node.alt === "string" &&
        node.alt
      ) {
        extractRegexClasses(index, node.alt, false);
      }
      return;
    }
    if ((node.type === "text" || node.type === "html") && typeof node.value === "string") {
      // GFM autolinks duplicate the URL into a child text node; the link
      // handler already records the URL exactly, so scanning it again would
      // count one occurrence twice. Explicit links (`[text](url)`) keep both
      // appearances: the raw link source starts with `[`, a bare autolink is
      // exactly its URL.
      const isAutolinkText =
        node.type === "text" &&
        (parent?.type === "link" || parent?.type === "image") &&
        typeof parent.url === "string" &&
        node.value === parent.url &&
        isBareAutolink(text, parent);
      if (!isAutolinkText) extractRegexClasses(index, node.value, false);
    }
  });
  extractFrontmatterTokens(index, text);
  assignStrength(index);
  return index;
}

function isBareAutolink(source, linkNode) {
  const { start, end } = linkNode.position ?? {};
  if (start?.offset == null || end?.offset == null) return true;
  return source.slice(start.offset, end.offset) === linkNode.url;
}

function extractFrontmatterTokens(index, text) {
  const withoutBom = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const opener = withoutBom.match(/^---[ \t]*\r?\n/u);
  if (!opener) return;
  const rest = withoutBom.slice(opener[0].length);
  const closer = rest.search(/\r?\n---(?:\r?\n|$)/);
  if (closer === -1) return;
  extractRegexClasses(index, rest.slice(0, closer), false);
}

export function extractTokens(text) {
  return extractTokenIndex(text).tokens;
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

export function compareTokenIndexes(before, after) {
  const missing = [];
  for (const token of before.strong) {
    if (!after.tokens.has(token)) missing.push(token);
  }
  const weakMissing = [];
  for (const token of weakTokens(before)) {
    if (!after.tokens.has(token)) weakMissing.push(token);
  }
  // Per-class occurrence shifts among strong tokens. A decreased token paired
  // with an increased token of the same class reads as an unauthorised change
  // (including an existing value gaining occurrences at another's expense);
  // a lone decrease reads as consolidation and only warns.
  const decreased = [];
  const increasedByClass = new Map();
  const names = new Set([...Object.keys(before.classes), ...Object.keys(after.classes)]);
  for (const name of names) {
    const beforeMap = before.classes[name] ?? new Map();
    const afterMap = after.classes[name] ?? new Map();
    for (const [token, beforeCount] of beforeMap) {
      if (!before.strong.has(token)) continue;
      const afterCount = afterMap.get(token) ?? 0;
      if (afterCount === 0) continue;
      if (afterCount < beforeCount) decreased.push({ token, class: name, before: beforeCount, after: afterCount });
    }
    for (const [token, afterCount] of afterMap) {
      if (!after.strong.has(token)) continue;
      const surplus = afterCount - (beforeMap.get(token) ?? 0);
      for (let i = 0; i < surplus; i += 1) {
        if (!increasedByClass.has(name)) increasedByClass.set(name, []);
        increasedByClass.get(name).push(token);
      }
    }
  }
  for (const list of increasedByClass.values()) list.sort();
  const mutated = [];
  const remainingDecreased = [];
  for (const entry of decreased) {
    const gained = increasedByClass.get(entry.class) ?? [];
    if (gained.length > 0) mutated.push({ token: entry.token, changedTo: gained.shift(), class: entry.class });
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
      const entries = [...index.classes[name].entries()];
      return [
        name,
        {
          count: entries.reduce((sum, [, occurrences]) => sum + occurrences, 0),
          examples: entries.slice(0, 3).map(([token]) => token),
        },
      ];
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
