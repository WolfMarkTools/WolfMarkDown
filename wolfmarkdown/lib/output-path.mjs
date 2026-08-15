import { isAbsolute, join } from "node:path";

export function kebabFileName(title) {
  const stem =
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 60) || "wolfmarkdown-notes";
  return `${stem}.md`;
}

export function inferOutputPath({ cwd, explicitPath, title, hasDocsDir = false }) {
  if (explicitPath) {
    return isAbsolute(explicitPath) ? explicitPath : join(cwd, explicitPath);
  }
  const name = kebabFileName(title || "wolfmarkdown-notes");
  return hasDocsDir ? join(cwd, "docs", name) : join(cwd, name);
}
