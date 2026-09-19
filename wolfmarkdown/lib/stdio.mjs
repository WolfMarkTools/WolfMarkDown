import { readFile } from "node:fs/promises";

export function isStdinPath(path) {
  return path === "-";
}

export async function readTextSource(path) {
  if (!isStdinPath(path)) return readFile(path, "utf8");
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))).toString("utf8");
}
