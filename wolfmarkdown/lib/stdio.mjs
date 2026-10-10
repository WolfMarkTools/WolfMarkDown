import { readFile } from "node:fs/promises";

export function isStdinPath(path) {
  return path === "-";
}

export async function readTextSource(path, { stdin = process.stdin } = {}) {
  if (!isStdinPath(path)) return readFile(path, "utf8");
  if (stdin.isTTY) {
    throw new Error("Standard input has no piped data; pipe Markdown input or pass a file path.");
  }
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  return Buffer.concat(chunks.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))).toString("utf8");
}
