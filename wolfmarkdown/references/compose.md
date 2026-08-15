# Compose, paths, and publish

## Standalone documents

The finished file must make sense tomorrow to someone who never saw the originating conversation.

Convert chat-oriented language such as "As we discussed above", "Here is what I found", "You asked about", "The option I mentioned earlier", "I can also investigate", and "Let me know if" into standalone document language when the meaning is clear.

Do not fabricate missing context. If a statement cannot be decontextualised without guessing, keep the factual content conservatively.

## Titles and frontmatter

For a normal standalone document, derive a concise H1 from the source. Prefer `# Solana Paid-Action Architecture Research` over marketing titles.

Do not force an H1 when the user asked for a fragment, a README section, insert-into-existing-document content, or another structure where an H1 is wrong.

Do not add YAML frontmatter by default. Add it only when the user requests it, the target repository obviously requires it, or the source already has it.

## Output path

Honour an explicit output path.

When the user wants a new file but gives no path:

1. Use an established documentation directory when that convention is obvious (`docs/` is the usual signal).
2. Otherwise use the current working directory.
3. Derive a concise kebab-case `.md` filename from the content.
4. Do not invent a deep directory tree.

Report the chosen path.

## Existing files

Inspect a target that already exists. If the user clearly asked to replace or update that document, treat it as an existing-document operation and preserve what should survive. If they did not authorise replacement of unrelated content, do not overwrite it.

## Failure safety

For existing files: snapshot the untouched source first. If the result cannot pass mandatory verification, restore the original content before reporting FAIL.

For new files: write a temporary candidate. Publish to the destination only after PASS. Do not leave an unverified final file at the requested destination. Use OS temp storage. Do not commit snapshots or staging files.

Use `lib/publish.mjs` helpers when they fit: `writeExistingIfValid`, `publishNewFile`, `restoreOriginal`.
