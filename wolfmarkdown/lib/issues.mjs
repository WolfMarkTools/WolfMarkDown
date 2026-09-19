export function createIssue(check, message, { line = null, column = null, remediation } = {}) {
  return {
    check,
    message,
    line,
    column,
    remediation: remediation ?? remediationFor(check),
  };
}

export function remediationFor(check) {
  switch (check) {
    case "parse":
      return "Fix Markdown that the GFM parser cannot read, then verify again.";
    case "prettier":
      return "Format the file with format-markdown.mjs, then verify again.";
    case "idempotence":
      return "Re-run the formatter; a second pass should be a no-op.";
    case "fences":
      return "Close the opening fence with a matching marker of equal or greater length.";
    case "headings":
      return "Do not skip heading levels; follow the source outline.";
    case "tables":
      return "Give GFM tables a delimiter row and consistent cell counts, or keep non-tables as lists or separate paragraphs.";
    case "frontmatter":
      return "Close YAML frontmatter with --- and ensure the YAML parses.";
    case "whitespace":
      return "End the file with exactly one newline, keep at most one blank line between blocks, and use two-space hard breaks only.";
    case "markdownlint":
      return "Fix the named markdownlint rule, then verify again.";
    case "integrity":
      return "Restore the missing protected token from the untouched source snapshot.";
    default:
      return "Fix the reported Markdown issue, then verify again.";
  }
}

export function formatIssue(issue) {
  const loc = issue.line == null ? "" : ` on line ${issue.line}`;
  return `- ${issue.check}${loc}: ${issue.message} ${issue.remediation}`;
}
