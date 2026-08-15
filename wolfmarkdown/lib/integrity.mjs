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

function addAll(text, pattern, tokens, pick = (match) => match[0]) {
  for (const match of text.matchAll(pattern)) {
    const value = pick(match)?.replace(/[.,;:]+$/u, "");
    if (value) tokens.add(value);
  }
}

export function extractFromText(text, tokens = new Set()) {
  addAll(text, URL_RE, tokens);
  addAll(text, VERSION_RE, tokens);
  addAll(text, HEX_RE, tokens);
  addAll(text, BASE58_SIG_RE, tokens);
  addAll(text, BASE58_KEY_RE, tokens);
  addAll(text, ISO_DATE_RE, tokens);
  addAll(text, UK_DATE_RE, tokens);
  addAll(text, PERCENT_RE, tokens);
  addAll(text, CURRENCY_RE, tokens);
  addAll(text, HOME_OR_REL_PATH_RE, tokens);
  addAll(text, ABS_PATH_RE, tokens, (match) => match[1]);
  addAll(text, ENV_SCOPED_RE, tokens, (match) => match[1] || match[2]);
  addAll(text, ENV_ASSIGN_RE, tokens, (match) => match[1]);
  addAll(text, ENV_NAME_RE, tokens);
  addAll(text, CAMEL_IDENT_RE, tokens);
  addAll(text, SNAKE_IDENT_RE, tokens);
  return tokens;
}

export function extractTokens(text) {
  const tokens = new Set();
  const { tree } = parseMarkdown(text);
  visit(tree, (node) => {
    if (node.type === "inlineCode" && node.value) {
      tokens.add(node.value);
      extractFromText(node.value, tokens);
    } else if (node.type === "code" && node.value) {
      tokens.add(node.value.replace(/\n$/u, ""));
      extractFromText(node.value, tokens);
    } else if (node.type === "link" && node.url) {
      tokens.add(node.url);
    } else if (node.type === "text" && node.value) {
      extractFromText(node.value, tokens);
    }
  });
  extractFromText(text, tokens);
  return tokens;
}

export function compareTokens(before, after) {
  const afterSet = after instanceof Set ? after : extractTokens(after);
  const missing = [];
  for (const token of before) {
    if (!afterSet.has(token)) missing.push(token);
  }
  return { missing, ok: missing.length === 0 };
}
