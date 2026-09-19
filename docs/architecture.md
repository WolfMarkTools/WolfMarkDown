# Architecture and semantic repair

WolfMarkDown separates semantic judgement from deterministic proof:

> **Agent judgement for structure. Deterministic tooling for proof.**

The agent decides what the source means. WolfMarkDown's scripts check whether the resulting Markdown artifact is structurally and operationally safe to keep or publish.

## Workflow

1. **Inspect the source.** The agent reads the complete source or records the reviewed scope for a bounded pass.
2. **Build a source map.** It records document intent, heading relationships, candidate tables, repeated groups, protected regions, and unresolved ambiguities.
3. **Repair conservatively.** Clear structure may be recovered; probable structure gets the smallest wording-preserving change; ambiguous structure remains ambiguous and is reported.
4. **Format and verify.** Prettier is the sole final Markdown printer. Deterministic checks cover parsing, fences, lint, idempotence, publication safety, and optional integrity against the source snapshot.
5. **Reconcile before publishing.** Long or chunked work is checked against the full-document outline, sibling sections, table boundaries, protected values, and unresolved regions.

## Semantic repair boundary

WolfMarkDown can recover clear headings, lists, tables, paragraphs, and sibling sections. It does not manufacture structure merely to make a document look polished.

- A headerless tab-separated or aligned row run is not automatically a GFM table. Stable columns plus recognisable header evidence are needed.
- A short sentence is not automatically a heading.
- A lone `Label: value` phrase is not automatically a list item.
- A genuinely ambiguous row-like region remains non-tabular, using list items or separated paragraphs so Prettier cannot collapse its records into one paragraph.
- Code, frontmatter, links, literal examples, technical identifiers, and legitimate transcripts are preserved unless the user's request clearly authorises a change.
- Conversation scaffolding is removed only when it is clearly not part of the document being kept.

The full source-map and confidence workflow is documented in [semantic-repair.md](../wolfmarkdown/references/semantic-repair.md).

## Ownership boundary

| Agent-owned decisions | Deterministic proof |
| --- | --- |
| Intent and document scope | Markdown parsing and GFM checks |
| Heading, list, table, and paragraph recovery | Fence balance and frontmatter handling |
| Conversation sanitisation | Prettier formatting and idempotence |
| Ambiguity handling and source-map reconciliation | Markdown lint and protected-token integrity |
| Standalone composition and wording-preserving repair | Preview, receipts, rollback, and publish refusal |

Scripts do not become a second semantic editor. In particular, they do not infer tables or headings from visual alignment alone.

## Publication safety

Clean and Compose work through a candidate and verification evidence before changing the destination. The original source is snapshotted before editing. If Clean verification fails, the original is restored. If Compose verification fails, the requested destination is not published.

See [Verification, integrity, and PASS](./verification.md) for receipt, preview, and token-preservation details.
