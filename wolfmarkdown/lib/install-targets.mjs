import { access, lstat, mkdir, readFile, realpath, symlink, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

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
  const prettierEntry = join(canonicalDir, "node_modules", "prettier", "package.json");
  try {
    await access(prettierEntry, constants.F_OK);
  } catch {
    errors.push(`Dependencies are not installed in ${canonicalDir}. Run node scripts/install.mjs`);
  }
  return { ok: errors.length === 0, destination, links, errors };
}

async function dependenciesNeedRepair(canonicalDir) {
  try {
    const manifest = JSON.parse(await readFile(join(canonicalDir, "package.json"), "utf8"));
    for (const [name, expected] of Object.entries(manifest.dependencies ?? {})) {
      const installed = JSON.parse(await readFile(join(canonicalDir, "node_modules", name, "package.json"), "utf8"));
      if (installed.version !== expected) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function installDependencies(canonicalDir, platform = process.platform) {
  const command = spawnSync(npmExecutable(platform), ["ci"], { cwd: canonicalDir, stdio: "inherit" });
  if (command.status !== 0) {
    throw installError("npm ci failed while installing WolfMarkDown dependencies.");
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

export async function installSkill({ home, canonicalDir, skipDeps = false, platform = process.platform }) {
  const destination = defaultDestination(home);
  if (!skipDeps && (await dependenciesNeedRepair(canonicalDir))) {
    installDependencies(canonicalDir, platform);
  }
  const statuses = {};
  for (const target of discoveryTargets(home)) {
    statuses[target.id] = await ensureOwnedLink(target.destination, canonicalDir, platform);
  }
  const status = Object.values(statuses).every((value) => value === "unchanged") ? "unchanged" : "created";
  return { destination, status, statuses };
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
