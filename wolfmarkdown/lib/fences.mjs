const OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;
const CLOSE = /^(\s*)(`{3,}|~{3,})[ \t]*$/;

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

function columnWidth(text, start = 0) {
  let width = start;
  for (const char of text) {
    if (char === "\t") width += 4 - (width % 4);
    else width += 1;
  }
  return width;
}

function listContentIndent(line) {
  const match = line.match(/^(\s*)([-*+]|\d{1,9}[.)])([ \t]*)(.*)$/);
  if (!match) return null;
  if (match[3].length === 0 && match[4].length > 0) return null;
  const markerStart = columnWidth(match[1]);
  const afterMarker = markerStart + match[2].length;
  const padding = match[3].length === 0 ? 1 : columnWidth(match[3], afterMarker) - afterMarker;
  return afterMarker + padding;
}

function fenceAllowedAt(lines, index) {
  const indent = leadingIndent(lines[index]);
  if (indent <= 3) return true;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previous = lines[cursor];
    if (previous.trim() === "") continue;
    if (leadingIndent(previous) >= indent) continue;
    const contentIndent = listContentIndent(previous);
    if (contentIndent == null) return false;
    return indent <= contentIndent + 3;
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
