const OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;
const CLOSE = /^(\s*)(`{3,}|~{3,})[ \t]*$/;
const LIST_ITEM = /^(?:\s*)(?:[-*+]|\d{1,9}[.)])(?:[ \t]+|$)/;

function leadingIndent(line) {
  let indent = 0;
  for (const char of line) {
    if (char === " ") indent += 1;
    else if (char === "\t") indent += 4 - (indent % 4);
    else break;
  }
  return indent;
}

function openingFence(line) {
  const match = line.match(OPEN);
  if (!match) return null;
  const marker = match[2];
  const info = match[3] ?? "";
  if (marker.startsWith("`") && info.includes("`")) return null;
  return { char: marker[0], length: marker.length, indent: leadingIndent(line) };
}

function fenceAllowedAt(lines, index) {
  const indent = leadingIndent(lines[index]);
  if (indent <= 3) return true;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previous = lines[cursor];
    if (previous.trim() === "") continue;
    const previousIndent = leadingIndent(previous);
    if (previousIndent < indent) return LIST_ITEM.test(previous);
    if (LIST_ITEM.test(previous) && previousIndent < indent) return true;
  }
  return false;
}

function closingFence(line, open, lines, index) {
  if (!fenceAllowedAt(lines, index)) return false;
  const match = line.match(CLOSE);
  if (!match) return false;
  if (leadingIndent(line) > open.indent + 3) return false;
  const marker = match[2];
  return marker[0] === open.char && marker.length >= open.length;
}

export function lineFenceStates(text) {
  const lines = text.split("\n");
  const inside = Array.from({ length: lines.length }, () => false);
  let open = null;
  let openLine = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (open) {
      inside[index] = true;
      if (closingFence(line, open, lines, index)) {
        open = null;
      }
      continue;
    }
    if (!fenceAllowedAt(lines, index)) continue;
    const next = openingFence(line);
    if (next) {
      open = next;
      openLine = index + 1;
      inside[index] = true;
    }
  }
  return { lines, inside, open, openLine };
}

export function assertFencesBalanced(text) {
  const { open, openLine } = lineFenceStates(text);
  if (!open) return { ok: true, errors: [], openLine: 0 };
  const kind = open.char === "`" ? "backtick" : "tilde";
  const message = `Unclosed ${kind} fence starting on line ${openLine}.`;
  return { ok: false, errors: [message], openLine, message };
}
