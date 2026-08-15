# Mobile App Migration Example

This example demonstrates WolfMarkDown recovering structure from raw AI output.

The source intentionally contains:

- ChatGPT-style wrapper text
- Flattened tab-separated tables
- Unicode bullet lists
- Unstructured configuration values
- Ambiguous notes that must not be expanded

WolfMarkDown recovers:

- Heading hierarchy
- GFM tables
- Markdown lists
- Code blocks
- Protected technical values

It does not:

- Verify factual correctness
- Invent missing information
- Rewrite technical meaning

## Reproduction details

- Harness: OpenCode
- Model: GLM-5.2
- Prompt:

  ```text
  /wolfmarkdown use the skill to convert this into a .md file
  ```
