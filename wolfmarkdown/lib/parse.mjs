import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

export function createProcessor() {
  return remark().use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
}

export function parseMarkdown(text) {
  const processor = createProcessor();
  return { tree: processor.parse(text), processor };
}
