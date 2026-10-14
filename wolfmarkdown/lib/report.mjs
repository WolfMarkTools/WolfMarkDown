import { createHash } from "node:crypto";
import { formatIssue } from "./issues.mjs";
import { loadJson } from "./paths.mjs";

export const QUALITY_BOUNDARY =
  "A PASS is Markdown artifact evidence. It does not establish factual correctness, completeness, currency, policy compliance, or authorisation to publish.";

export function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function skillVersions() {
  try {
    const manifest = loadJson("package.json");
    return {
      wolfmarkdown: manifest.version,
      node: process.versions.node,
      dependencies: { ...(manifest.dependencies ?? {}) },
    };
  } catch (error) {
    return {
      wolfmarkdown: null,
      node: process.versions.node,
      dependencies: {},
      error: error?.message ?? String(error),
    };
  }
}

export function formatErrors(errors, issues) {
  if (issues?.length) return issues.map((issue) => formatIssue(issue)).join("\n");
  return errors.map((error) => `- ${error}`).join("\n");
}

function checkState(passed) {
  if (passed == null) return { text: "Skip", json: "skip" };
  if (passed) return { text: "Pass", json: "pass" };
  return { text: "Fail", json: "fail" };
}

export function summariseChecks(checks) {
  return Object.entries(checks)
    .map(([name, passed]) => `${name}: ${checkState(passed).text}`)
    .join("\n");
}

export function toPublicResult(result) {
  return {
    ok: Boolean(result.ok),
    checks: Object.fromEntries(
      Object.entries(result.checks ?? {}).map(([name, passed]) => [name, checkState(passed).json]),
    ),
    errors: [...(result.errors ?? [])],
  };
}

export function toReceipt(result, {
  candidatePath = null,
  candidateText = "",
  integrityFromPath = null,
  integrityFromText,
  preview = null,
} = {}) {
  return {
    ...toPublicResult(result),
    qualityBoundary: QUALITY_BOUNDARY,
    versions: skillVersions(),
    files: {
      candidate:
        candidatePath == null
          ? null
          : { path: candidatePath, hash: candidateText == null ? null : hashText(candidateText) },
      integrityFrom:
        integrityFromPath == null
          ? null
          : { path: integrityFromPath, hash: integrityFromText == null ? null : hashText(integrityFromText) },
    },
    issues: [...(result.issues ?? [])],
    warnings: [...(result.integrityCoverage?.warnings ?? []), ...(result.warnings ?? [])],
    integrityCoverage: result.integrityCoverage ?? null,
    timings: result.timings ?? null,
    preview,
  };
}

export function formatWarnings(warnings) {
  if (!warnings?.length) return "";
  return warnings
    .map((warning) => {
      const examples = warning.examples?.length ? ` Examples: ${warning.examples.join(", ")}.` : "";
      return `- ${warning.message}${examples}`;
    })
    .join("\n");
}
