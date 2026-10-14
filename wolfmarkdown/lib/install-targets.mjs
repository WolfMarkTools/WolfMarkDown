import { lstat, mkdir, realpath, symlink, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { inspectDependencies } from "./dependencies.mjs";

export function defaultDestination(home) {
  return join(home, ".agents", "skills", "wolfmarkdown");
}

export function claudeDestination(home) {
  return join(home, ".claude", "skills", "wolfmarkdown");
}

export function discoveryTargets(home) {
  return [
    { id: "shared", destination: defaultDestination(home), required: true },
    { id: "claude", destination: claudeDestination(home), required: false },
  ];
}

export function linkTypeFor(platform) {
  return platform === "win32" ? "junction" : undefined;
}

export function npmExecutable(platform = process.platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

export function pathsPointAtSameDir(left, right) {
  return resolve(left) === resolve(right);
}

function installError(message) {
  const error = new Error(message);
  error.name = "InstallError";
  return error;
}

export function nodeMajorForInstall(nodeVersion = process.versions.node) {
  return Number(String(nodeVersion).replace(/^v/u, "").split(".")[0]);
}

export function checkNodeForInstall(nodeVersion = process.versions.node) {
  const major = nodeMajorForInstall(nodeVersion);
  if (!Number.isFinite(major) || major < 22) {
    throw installError(`Node.js 22+ required to install WolfMarkDown dependencies, found ${nodeVersion}.`);
  }
}

async function readExisting(dest) {
  try {
    return await lstat(dest);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function isLegacyLabsCanonical(path) {
  return resolve(path).replaceAll("\\", "/").endsWith("/WolfMark-Lab/skills/wolfmarkdown");
}

async function ownedLink(destination, canonicalDir) {
  const existing = await readExisting(destination);
  if (!existing) return { existing: null, owned: false, destReal: null };
  try {
    const destReal = await realpath(destination);
    const canonReal = await realpath(canonicalDir);
    return { existing, destReal, owned: pathsPointAtSameDir(destReal, canonReal) };
  } catch {
    return { existing, destReal: null, owned: false };
  }
}

export async function checkInstall({ home, canonicalDir }) {
  const destination = defaultDestination(home);
  const errors = [];
  const links = {};
  for (const target of discoveryTargets(home)) {
    const { existing, owned } = await ownedLink(target.destination, canonicalDir);
    links[target.id] = Boolean(owned);
    if (!target.required) continue;
    if (!existing) {
      errors.push(`Missing ${target.id} discovery link at ${target.destination}.`);
    } else if (!owned) {
      errors.push(`Destination exists and is not an owned WolfMarkDown link: ${target.destination}`);
    }
  }
  const deps = await inspectDependencies(canonicalDir);
  if (!deps.ok) errors.push(...deps.errors);
  return { ok: errors.length === 0, destination, links, errors };
}

async function dependenciesNeedRepair(canonicalDir) {
  const deps = await inspectDependencies(canonicalDir);
  return !deps.ok;
}

export function describeNpmFailure(command, timeoutMs) {
  if (command.error) {
    if (command.error.code === "ETIMEDOUT") {
      return `npm ci timed out after ${timeoutMs}ms while installing WolfMarkDown dependencies.`;
    }
    return `Could not run npm ci while installing WolfMarkDown dependencies (${command.error.code ?? command.error.message}).`;
  }
  const output = [command.stdout, command.stderr].filter(Boolean).join("\n").slice(-2000);
  return `npm ci failed while installing WolfMarkDown dependencies (exit ${command.status}).${output ? `\n${output}` : ""}`;
}

function installDependencies(canonicalDir, platform = process.platform, { timeoutMs = 120_000 } = {}) {
  checkNodeForInstall();
  const command = spawnSync(npmExecutable(platform), ["ci"], {
    cwd: canonicalDir,
    stdio: "pipe",
    encoding: "utf8",
    timeout: timeoutMs,
  });
  if (command.error || command.status !== 0) {
    throw installError(describeNpmFailure(command, timeoutMs));
  }
}

async function ensureOwnedLink(destination, canonicalDir, platform) {
  const { existing, owned, destReal } = await ownedLink(destination, canonicalDir);
  if (existing && !owned) {
    const danglingLink = Boolean(existing.isSymbolicLink()) && !destReal;
    if (danglingLink || (destReal && isLegacyLabsCanonical(destReal))) {
      await unlink(destination);
    } else {
      throw installError(`Destination exists and is not an owned WolfMarkDown link: ${destination}`);
    }
  }
  if (owned) return "unchanged";
  await mkdir(dirname(destination), { recursive: true });
  const type = linkTypeFor(platform);
  if (type) await symlink(resolve(canonicalDir), destination, type);
  else await symlink(resolve(canonicalDir), destination);
  return "created";
}

export async function installSkill({ home, canonicalDir, skipDeps = false, runtimeOnly = false, platform = process.platform }) {
  const destination = defaultDestination(home);
  let dependenciesRepaired = false;
  if (!skipDeps && (await dependenciesNeedRepair(canonicalDir))) {
    installDependencies(canonicalDir, platform);
    dependenciesRepaired = true;
  }
  if (runtimeOnly) {
    return { destination, status: "runtime-only", statuses: {}, dependenciesRepaired };
  }
  const statuses = {};
  for (const target of discoveryTargets(home)) {
    statuses[target.id] = await ensureOwnedLink(target.destination, canonicalDir, platform);
  }
  const status = Object.values(statuses).every((value) => value === "unchanged") ? "unchanged" : "created";
  return { destination, status, statuses, dependenciesRepaired };
}

export async function uninstallSkill({ home, canonicalDir }) {
  let removed = false;
  for (const target of discoveryTargets(home)) {
    const { existing, owned } = await ownedLink(target.destination, canonicalDir);
    if (!existing) continue;
    if (!owned) {
      throw installError(`Refusing to remove a foreign path: ${target.destination}`);
    }
    await unlink(target.destination);
    removed = true;
  }
  return removed;
}
