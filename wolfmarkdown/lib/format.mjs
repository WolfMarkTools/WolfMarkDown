import prettier from "prettier";
import { loadPrettierOptions } from "./paths.mjs";

export async function formatMarkdown(text) {
  return prettier.format(text, {
    ...loadPrettierOptions(),
    parser: "markdown",
  });
}
