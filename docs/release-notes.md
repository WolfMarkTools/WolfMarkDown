# Release notes

## v1.0.0

WolfMarkDown v1.0.0 is the first 1.0 release of the agent publishing workflow. It keeps the product surface focused on Setup, Doctor, Verify, Clean, and Compose.

The release includes:

- verification receipts containing hashes, versions, checks, issues, remediations, integrity coverage, and the quality boundary;
- deterministic source-to-candidate previews before Clean and Compose publish;
- integrity coverage reporting for recognised protected-token classes and explicit warnings for unsupported shapes;
- batch Verify for directories and multiple Markdown files;
- scaffold inventory for long-document semantic handoff without turning the inventory into a semantic rewriter;
- atomic, symlink-aware writes and safe rollback/refusal behaviour;
- standard-input support for Verify, Format, and scaffold; and
- CI coverage on Node.js 20, 22, and 24.

The release's evidence boundary remains deliberate: passing tests, skill validation, CI, or a host-integration intake does not prove factual correctness, publication authorisation, or identical semantic quality across every host and model.
