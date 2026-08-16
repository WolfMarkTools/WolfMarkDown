# Semantic repair

Use this workflow for Clean or Compose when source material has latent structure. The agent owns every semantic decision. Scripts prove only formatting, parsing, integrity, and idempotence.

## Pass 1: build a source map

Read the complete source before editing. Inventory only signals actually present:

- title-like boundaries and their likely parent/sibling relationships;
- table runs indicated by tabs, alignment, delimiters, or repeated row shape;
- repeated labelled facts such as `Status:`, `Owner:`, or `Recommendation:`;
- ordered sequences whose order affects meaning;
- conceptual paragraph transitions;
- protected islands: code, frontmatter, links, identifiers, literal examples, and intentional transcripts.

Classify each region as one of:

- **Preserve**: already-good prose or Markdown, code, transcript, or an ambiguous region where restructuring would invent meaning.
- **Restructure**: clear latent headings, tables, lists, paragraphs, or hierarchy.
- **Sanitise**: conversation scaffolding that is not part of the document.
- **Compose**: document-level context needed to make exported source standalone, without adding unsupported facts.
- **Unresolved**: a signal that remains genuinely ambiguous after considering its neighbours.

Do not treat missing blank lines as evidence that a source block is one paragraph. Do not flatten clear structure merely because choosing exact Markdown hierarchy requires judgement.

Keep the source map concise and internal unless the user asks to see it.

## Long documents and agent handoff

When a source is too large to reason about safely in one working pass, establish a document ledger before rewriting. Record the document intent, top-level section order, candidate tables and header status, repeated groups and sequences, and protected regions.

Process bounded regions only at confirmed section boundaries. Carry the parent outline and relevant ledger entries into each pass; do not restart the source map for every chunk or treat the final chunk as an independent document.

After each pass, update an internal semantic handoff. Do not add this handoff to the user's document or commit it as source material. It must record:

- **Source scope:** complete or the reviewed section boundaries;
- **Outline:** recovered or preserved parent and sibling relationships;
- **Structures:** tables, labelled groups, sequences, and paragraphs handled or intentionally preserved;
- **Protected regions:** regions that must remain exact;
- **Unresolved:** ambiguities and their conservative treatment;
- **Reconciliation:** which ledger entries still need a whole-document check.

Before publishing, reassemble the candidate and reconcile the full heading hierarchy, sibling relationships, table boundaries, and protected tokens across chunk boundaries. If the full source cannot be mapped or reviewed, preserve uncertain regions and report the scope limit. Never infer missing context from an incomplete view.

## Confidence rule

- **Clear signal**: restructure it and require reconciliation.
- **Probable signal**: make the smallest structural change that preserves wording and source order.
- **Ambiguous signal**: preserve it conservatively and report the ambiguity.
- **Protected region**: do not semantically rewrite it.

An unresolved ambiguity does not automatically fail the operation when the source is preserved safely. Silently inventing meaning or flattening a clear signal does.

## Pass 2: build the candidate

Work from the source map, preserving source order unless a different order is explicit.

### Headings and sibling sections

Promote a title-like line when its wording, position, and neighbouring content establish a section boundary. Choose the lowest logical heading level under the current parent. Keep repeated verdicts, experiments, providers, agenda items, or recommendations independently addressable when they are peers.

Do not promote an isolated short sentence solely because it is short. When boundary evidence is probable but not conclusive, prefer a conservative heading or paragraph break that preserves wording over merging it into unrelated prose.

### Tables

Treat consecutive rows as a table candidate only when both the column boundaries and a recognisable header row are clear. Evidence may include a stable column count together with tabs, aligned spacing, delimiters, repeated field positions, and a first row that names dimensions or fields. A stable row shape by itself does not prove that the first row is a header. When header intent is not clear, preserve the region as a list or as separated paragraphs and record the ambiguity rather than inventing a schema. Preserve every row and cell, including empty cells. Escape literal pipes when required by GFM.

If row boundaries are clear but one row has fewer cells, leave unknown trailing cells empty. If column boundaries themselves are ambiguous, preserve the source as a list or as separated paragraphs and record the ambiguity; never invent cells.

### Do not manufacture structure

- A stable run of tab-separated or aligned values without a recognisable header is not a GFM table.
- A short sentence, warning, or conclusion is not a heading unless its position and neighbours establish a section boundary.
- A lone `Label: value` phrase inside prose is not a labelled list; require repeated peer facts or an explicit list boundary.
- Do not restructure a region solely to make the document look more polished. Preserve wording and order when the semantic signal is not clear.

### Printer-surviving record boundaries

When ambiguous row-like content must remain non-tabular, preserve each record boundary in Markdown that survives Prettier, such as a list item or a blank-line-separated paragraph. Do not leave adjacent raw rows that the printer will collapse into one paragraph. Do not invent a table, labels, or relationships merely to keep the rows apart. Choose the least-assumptive representation the source justifies.

### Lists and labelled groups

Convert decorative bullets to Markdown list items when they introduce repeated peer facts. Prefer `- **Label:** value` for labelled facts. Preserve nested relationships and keep ordered steps numbered when order matters. A label that owns steps, findings, failures, or sub-items should contain a nested list rather than absorb them into one sentence.

Do not turn ordinary prose into a list merely because several sentences share a topic.

### Paragraphs

Split prose at clear changes of subject, conclusion, rationale, risk, or recommendation. Keep sentences together when they form one argument. Preserve wording unless a small edit is required for standalone grammar or to remove conversation scaffolding.

### Technical content

Preserve protected content exactly. Inline-code styling may be added around identifiers, commands, paths, and instruction names only when the enclosed text remains unchanged. Never rewrite code or configuration to improve prose style.

## Reconcile before formatting

Compare the candidate with the source map before running Prettier:

1. Confirm the source map or semantic handoff covers the complete source scope.
2. Account for every clear table run and preserve its rows and cells.
3. Account for every clear section boundary; confirm peer sections remain peers.
4. Account for repeated labelled groups and ordered sequences.
5. Confirm paragraph breaks reflect conceptual transitions rather than source whitespace alone.
6. Confirm preserved regions remain materially unchanged.
7. Confirm unresolved regions are reported and were not silently flattened or invented.
8. Confirm preserved row-like runs still have distinct record boundaries that will survive Prettier.
9. Confirm protected tokens survive exactly, then run deterministic integrity verification against the original snapshot.

Semantic repair passes only when all clear source signals are accounted for. A candidate that merely parses, formats, and preserves tokens is not sufficient.

## Report semantic evidence

Report concise, source-grounded evidence rather than an unsupported `Pass`:

- headings recovered or confirmed unchanged;
- tables rebuilt and the source runs they represent;
- list groups normalised and ordered sequences preserved;
- material paragraph or sibling-section recovery;
- source scope and any cross-section reconciliation for long documents;
- unresolved ambiguities, or `None`.

Do not invent counts. For large documents, representative section names plus totals derived from the source map are sufficient.
