# WolfMarkDown Markdown style

Use GitHub Flavoured Markdown. Prefer concise technical documentation tone. Do not add conversational filler, marketing language, or decorative separators.

When composing a new file, write it as a standalone committed document: one H1, a logical heading hierarchy, and no leftover chat voice. Do not paste a raw agent reply and call it finished.

## Headings

Use ATX headings with exactly one space after `#`. Keep a logical hierarchy and do not skip levels. Prefer a single H1 on standalone documents. Convert obvious plain-text section labels such as `CURRENT VERDICT` into headings when they are sections.

## Lists

Use `-` for unordered lists. Preserve intentional nesting. Use numbered lists when sequence matters. Do not turn ordinary paragraphs into lists.

Unicode `•` is not a Markdown list marker. Convert it during semantic restructuring, not by hoping the formatter will do it.

## Code

Use fenced code with triple backticks. Add a language only when it is known confidently. Do not rewrite code or configuration examples. Keep fences balanced.

## Inline code

Use inline code for commands, filenames, paths, configuration keys, identifiers, and package names. Do not wrap ordinary prose.

## Tables

Use valid GFM tables when the content is a structured comparison. Rebuild malformed comparison blocks only when the columns are clear. Do not invent missing cells. Compact, valid tables are enough; do not hand-pad columns.

## Whitespace and wrapping

Remove trailing spaces. Use one blank line between blocks. End the file with exactly one newline. Keep prose as single logical lines. The formatter uses Prettier with `proseWrap: never`.

## Emphasis, links, HTML, frontmatter

Use emphasis sparingly. Never mutate a URL target. Raw URLs are allowed when a title would not improve readability. Prefer Markdown over new HTML; keep existing HTML when it is required. Preserve YAML frontmatter values and do not turn the opening `---` into a horizontal rule. Use horizontal rules rarely.
