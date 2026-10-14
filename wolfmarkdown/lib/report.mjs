import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readConfig } from "markdownlint/sync";
import { formatIssue } from "./issues.mjs";
import { loadJson, skillRoot } from "./paths.mjs";

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

// Effective lint configuration: the pinned markdownlint version, the
// bundled rule inventory, the rules switched off by this project's policy
// and the normalised non-false overrides. Rules not listed in
// disabled/configured run with markdownlint's own defaults for this
// version; the inventory is derived from the installed, pinned package and
// is guarded by a test so a dependency bump surfaces any drift.
export function lintEvidence() {
  try {
    const normalised = readConfig(join(skillRoot, "config", "markdownlint.json"));
    const disabled = [];
    const configured = {};
    for (const [key, value] of Object.entries(normalised)) {
      if (!/^MD\d+$/u.test(key)) continue;
      if (value === false) disabled.push(key);
      else configured[key] = value;
    }
    let bundledRules = null;
    try {
      const libDir = join(skillRoot, "node_modules", "markdownlint", "lib");
      const files = readdirSync(libDir).filter((name) => /^md[0-9a-z-]*\.mjs$/u.test(name));
      const ids = [];
      for (const file of files) {
        const text = readFileSync(join(libDir, file), "utf8");
        for (const match of text.matchAll(/"names":\s*\[\s*"(MD\d+)"/gu)) ids.push(match[1]);
      }
      bundledRules = ids.sort();
    } catch {
      bundledRules = null;
    }
    let version = null;
    try {
      version = JSON.parse(
        readFileSync(join(skillRoot, "node_modules", "markdownlint", "package.json"), "utf8"),
      ).version;
    } catch {
      version = null;
    }
    return {
      version,
      bundledRules,
      disabled: disabled.sort(),
      configured,
      inherited: "Rules not listed in disabled/configured run with markdownlint's defaults for this version.",
    };
  } catch (error) {
    return { error: error?.message ?? String(error) };
  }
}

export function formatErrors(errors, issues) {
  if (issues?.length) return issues.map((issue) => formatIssue(issue)).join("\n");
  return errors.map((error) => `- ${error}`).join("\n");
}

function checkState(passed) {
  if (passed == null || passed === "skip") return { text: "Skip", json: "skip" };
  if (passed === "fail") return { text: "Fail", json: "fail" };
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
  invariantsPath = null,
  invariantsText = null,
  preview = null,
} = {}) {
  const previewWarnings =
    preview?.lineReduction?.warn === true
      ? [
          {
            code: "large-line-reduction",
            message: `Non-blank lines fell from ${preview.lineReduction.source} to ${preview.lineReduction.candidate} (${preview.lineReduction.reducedBy} fewer); review for collapsed content. This is a warning, not a failure.`,
            examples: [],
          },
        ]
      : [];
  return {
    ...toPublicResult(result),
    qualityBoundary: QUALITY_BOUNDARY,
    versions: skillVersions(),
    lint: lintEvidence(),
    files: {
      candidate:
        candidatePath == null
          ? null
          : { path: candidatePath, hash: candidateText == null ? null : hashText(candidateText) },
      integrityFrom:
        integrityFromPath == null
          ? null
          : { path: integrityFromPath, hash: integrityFromText == null ? null : hashText(integrityFromText) },
      invariants:
        invariantsPath == null
          ? null
          : { path: invariantsPath, hash: invariantsText == null ? null : hashText(invariantsText) },
    },
    invariants: result.invariantsEvidence ?? null,
    issues: [...(result.issues ?? [])],
    warnings: [
      ...(result.integrityCoverage?.warnings ?? []),
      ...(result.warnings ?? []),
      ...previewWarnings,
    ],
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
