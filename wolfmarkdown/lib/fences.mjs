const OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const CLOSE = /^( {0,3})(`{3,}|~{3,})[ \t]*$/;

function openingFence(line) {
  const match = line.match(OPEN);
  if (!match) return null;
  const marker = match[2];
  const info = match[3] ?? "";
  if (marker.startsWith("`") && info.includes("`")) return null;
  return { char: marker[0], length: marker.length };
}

function closingFence(line, open) {
  const match = line.match(CLOSE);
  if (!match) return false;
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
      if (closingFence(line, open)) {
        open = null;
      }
      continue;
    }
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
  if (!open) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [`Unclosed ${open.char === "`" ? "backtick" : "tilde"} fence starting on line ${openLine}.`],
  };
}
