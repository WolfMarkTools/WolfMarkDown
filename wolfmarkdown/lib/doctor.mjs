import { accessSync } from "node:fs";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { claudeDestination, defaultDestination, pathsPointAtSameDir } from "./install-targets.mjs";

const REQUIRED_SCRIPTS = ["format-markdown.mjs", "verify-markdown.mjs", "install.mjs", "doctor.mjs"];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function discoveryPointsAt(destination, canonicalDir, errors, label) {
  try {
    const destReal = await realpath(destination);
    const canonReal = await realpath(canonicalDir);
    if (pathsPointAtSameDir(destReal, canonReal)) return true;
    errors.push(`${label} at ${destination} points at ${destReal}, expected ${canonReal}.`);
    return false;
  } catch {
    errors.push(`${label} is missing at ${destination}.`);
    return false;
  }
}

async function dependenciesHealthy(canonicalDir, errors) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(canonicalDir, "package.json"), "utf8"));
  } catch {
    errors.push("package.json is missing.");
    return false;
  }
  let ok = true;
  for (const [name, expected] of Object.entries(manifest.dependencies ?? {})) {
    try {
      const installed = JSON.parse(await readFile(join(canonicalDir, "node_modules", name, "package.json"), "utf8"));
      if (installed.version !== expected) {
        ok = false;
        errors.push(`${name} ${installed.version} does not match required ${expected}.`);
      }
    } catch {
      ok = false;
      errors.push(`Dependency not installed: ${name}@${expected}`);
    }
  }
  return ok;
}

export async function inspectHealth({
  home,
  canonicalDir,
  projectRoot,
  nodeVersion = process.versions.node,
  lookFor,
}) {
  const runtime = { checks: {}, errors: [] };
  const discovery = { checks: {}, errors: [] };

  const major = Number(String(nodeVersion).replace(/^v/u, "").split(".")[0]);
  runtime.checks.node = Number.isFinite(major) && major >= 20;
  if (!runtime.checks.node) runtime.errors.push(`Node.js 20+ required, found ${nodeVersion}.`);

  try {
    runtime.checks.skillDir = (await stat(canonicalDir)).isDirectory();
  } catch {
    runtime.checks.skillDir = false;
    runtime.errors.push(`Canonical skill directory missing: ${canonicalDir}`);
  }

  runtime.checks.skillMd = await exists(join(canonicalDir, "SKILL.md"));
  if (!runtime.checks.skillMd) runtime.errors.push("SKILL.md is missing.");

  runtime.checks.scripts = true;
  for (const name of REQUIRED_SCRIPTS) {
    if (!(await exists(join(canonicalDir, "scripts", name)))) {
      runtime.checks.scripts = false;
      runtime.errors.push(`Missing script: scripts/${name}`);
    }
  }

  runtime.checks.dependencies = await dependenciesHealthy(canonicalDir, runtime.errors);
  runtime.ok = runtime.errors.length === 0;

  discovery.checks.shared = await discoveryPointsAt(
    defaultDestination(home),
    canonicalDir,
    discovery.errors,
    "Shared Agent Skills",
  );
  discovery.checks.global = discovery.checks.shared;
  discovery.checks.claude = await discoveryPointsAt(claudeDestination(home), canonicalDir, [], "Claude Code");
  let projectReady = false;
  if (projectRoot) {
    discovery.checks.project = await discoveryPointsAt(
      join(projectRoot, ".agents", "skills", "wolfmarkdown"),
      canonicalDir,
      discovery.errors,
      "Project discovery",
    );
    projectReady = discovery.checks.project;
  } else {
    discovery.checks.project = true;
  }
  discovery.ok = discovery.checks.shared && discovery.checks.project;
  const agents = describeAgents({
    home,
    lookFor,
    sharedReady: discovery.checks.shared,
    claudeReady: discovery.checks.claude,
    projectReady,
  });
  const runtimeOk = runtime.ok;
  const discoveryOk = discovery.ok;
  const overallOk = runtimeOk && discoveryOk;
  return {
    ok: overallOk,
    runtimeOk,
    discoveryOk,
    overallOk,
    runtime,
    discovery,
    agents,
  };
}

const AGENT_CATALOGUE = [
  { id: "codex", name: "Codex", tier: 1, discovery: "shared", acceptance: "tested" },
  { id: "cursor", name: "Cursor", tier: 1, discovery: "shared", acceptance: "tested" },
  { id: "grok", name: "Grok Build", tier: 1, discovery: "shared", acceptance: "tested" },
  { id: "claude", name: "Claude Code", tier: 1, discovery: "claude", acceptance: "tested" },
  { id: "opencode", name: "OpenCode", tier: 1, discovery: "shared", acceptance: "pending" },
  { id: "gemini", name: "Gemini CLI", tier: 1, discovery: "shared", acceptance: "pending" },
  { id: "antigravity", name: "Antigravity", tier: 1, discovery: "project-shared", acceptance: "pending" },
  { id: "copilot", name: "GitHub Copilot", tier: 2, discovery: "shared", acceptance: "pending" },
];

function claudeLooksInstalled(home) {
  return (
    existsSyncSafe(join(home, ".claude", "settings.json")) ||
    existsSyncSafe(join(home, ".claude", "settings.local.json")) ||
    existsSyncSafe(join(home, ".claude.json"))
  );
}

function defaultLookFor(home) {
  const macAntigravity = join(home, "Library", "Application Support", "Antigravity");
  return {
    claude: claudeLooksInstalled(home),
    codex: existsSyncSafe(join(home, ".codex")),
    cursor: existsSyncSafe(join(home, ".cursor")),
    grok: existsSyncSafe(join(home, ".grok")),
    opencode: existsSyncSafe(join(home, ".opencode")) || existsSyncSafe(join(home, ".config", "opencode")),
    gemini: existsSyncSafe(join(home, ".gemini")) || existsSyncSafe(join(home, ".config", "gemini")),
    antigravity: existsSyncSafe(join(home, ".antigravity")) || existsSyncSafe(macAntigravity),
    copilot: false,
  };
}

function existsSyncSafe(path) {
  try {
    accessSync(path);
    return true;
  } catch {
    return false;
  }
}

export function candidateBinaries(name, platform = process.platform) {
  const names = [name, `${name}.exe`];
  if (platform === "win32") names.push(`${name}.cmd`, `${name}.bat`);
  return names;
}

function binsOnPath() {
  const found = {};
  const parts = (process.env.PATH || "").split(delimiter);
  for (const name of ["claude", "codex", "cursor", "grok", "opencode", "gemini", "copilot"]) {
    found[name] = parts.some((dir) => candidateBinaries(name).some((bin) => existsSyncSafe(join(dir, bin))));
  }
  return found;
}

export function mergeDetection(dirHits, binHits) {
  const merged = { ...dirHits };
  for (const [name, found] of Object.entries(binHits)) {
    if (found) merged[name] = true;
  }
  return merged;
}

function describeAgents({ home, lookFor, sharedReady, claudeReady, projectReady }) {
  const detected =
    lookFor === undefined
      ? mergeDetection(defaultLookFor(home || homedir()), binsOnPath())
      : { ...defaultLookFor(home || homedir()), ...lookFor };
  return AGENT_CATALOGUE.map((agent) => {
    const isDetected = Boolean(detected[agent.id]);
    let discoveryReady = false;
    if (agent.discovery === "claude") discoveryReady = Boolean(claudeReady);
    else if (agent.discovery === "project-shared") discoveryReady = Boolean(sharedReady || projectReady);
    else discoveryReady = Boolean(sharedReady);
    let status = "Not detected";
    if (isDetected && discoveryReady) status = "Ready";
    else if (isDetected && agent.id === "claude" && !claudeReady) status = "Optional compatibility link missing";
    else if (isDetected) status = "Detected";
    else if (!isDetected) status = "Not detected";
    return {
      id: agent.id,
      name: agent.name,
      tier: agent.tier,
      compatible: true,
      acceptance: agent.acceptance,
      detected: isDetected,
      discoveryReady,
      status,
    };
  });
}
