import assert from "node:assert/strict";
import { mkdir, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkInstall, defaultDestination, installSkill, linkTypeFor, npmExecutable, pathsPointAtSameDir, uninstallSkill } from "../lib/install-targets.mjs";
import { candidateBinaries, inspectHealth } from "../lib/doctor.mjs";
import { skillRoot } from "./helpers.mjs";

async function withHome(run) {
  const home = await mkdtemp(join(tmpdir(), "wolfmarkdown-home-"));
  try {
    return await run(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

test("install creates shared and Claude discovery links to the canonical skill", async () => {
  await withHome(async (home) => {
    const result = await installSkill({ home, canonicalDir: skillRoot, skipDeps: true });
    const shared = join(home, ".agents", "skills", "wolfmarkdown");
    const claude = join(home, ".claude", "skills", "wolfmarkdown");
    assert.equal(result.destination, shared);
    assert.equal(await readlink(shared), skillRoot);
    assert.equal(await readlink(claude), skillRoot);
    await assert.rejects(stat(join(home, ".codex", "skills", "wolfmarkdown")));
    await assert.rejects(stat(join(home, ".cursor", "skills", "wolfmarkdown")));
    await assert.rejects(stat(join(home, ".grok", "skills", "wolfmarkdown")));
    const health = await inspectHealth({ home, canonicalDir: skillRoot });
    assert.equal(health.discovery.ok, true, health.discovery.errors.join("\n"));
    assert.equal(health.discovery.checks.shared, true);
    assert.equal(health.discovery.checks.claude, true);
    assert.equal(health.runtime.ok, true, health.runtime.errors.join("\n"));
  });
});

test("setup is idempotent when the owned link already exists", async () => {
  await withHome(async (home) => {
    const first = await installSkill({ home, canonicalDir: skillRoot, skipDeps: true });
    const second = await installSkill({ home, canonicalDir: skillRoot, skipDeps: true });
    assert.equal(first.status, "created");
    assert.equal(second.status, "unchanged");
    assert.equal(await readlink(join(home, ".agents", "skills", "wolfmarkdown")), skillRoot);
    assert.equal(await readlink(join(home, ".claude", "skills", "wolfmarkdown")), skillRoot);
  });
});

test("uninstall removes owned shared and Claude links only", async () => {
  await withHome(async (home) => {
    await installSkill({ home, canonicalDir: skillRoot, skipDeps: true });
    const removed = await uninstallSkill({ home, canonicalDir: skillRoot });
    assert.equal(removed, true);
    await assert.rejects(stat(join(home, ".agents", "skills", "wolfmarkdown")));
    await assert.rejects(stat(join(home, ".claude", "skills", "wolfmarkdown")));
  });
});

test("migrates legitimate WolfMark Labs links to the new canonical path", async () => {
  await withHome(async (home) => {
    const legacy = join(home, "src", "WolfMark-Lab", "skills", "wolfmarkdown");
    await mkdir(legacy, { recursive: true });
    await writeFile(join(legacy, "SKILL.md"), "legacy\n");
    const shared = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(join(home, ".agents", "skills"), { recursive: true });
    await symlink(legacy, shared);
    const result = await installSkill({ home, canonicalDir: skillRoot, skipDeps: true });
    assert.equal(result.status, "created");
    assert.equal(await readlink(shared), skillRoot);
    assert.equal(await readlink(join(home, ".claude", "skills", "wolfmarkdown")), skillRoot);
  });
});

test("refuses to replace a foreign Claude symlink", async () => {
  await withHome(async (home) => {
    const claude = join(home, ".claude", "skills", "wolfmarkdown");
    await mkdir(join(home, ".claude", "skills"), { recursive: true });
    await symlink(home, claude);
    await assert.rejects(installSkill({ home, canonicalDir: skillRoot, skipDeps: true }), /foreign|owned|exists/i);
  });
});

test("defaultDestination uses platform path segments", () => {
  const dest = defaultDestination(join("Users", "mark"));
  assert.equal(dest, join("Users", "mark", ".agents", "skills", "wolfmarkdown"));
});

test("linkTypeFor uses a directory junction on win32 only", () => {
  assert.equal(linkTypeFor("win32"), "junction");
  assert.equal(linkTypeFor("darwin"), undefined);
  assert.equal(linkTypeFor("linux"), undefined);
});

test("pathsPointAtSameDir compares resolved locations", () => {
  assert.equal(pathsPointAtSameDir(skillRoot, join(skillRoot, ".")), true);
});

test("checkInstall succeeds when only the required shared link exists", async () => {
  await withHome(async (home) => {
    const shared = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(join(home, ".agents", "skills"), { recursive: true });
    await symlink(skillRoot, shared);
    const result = await checkInstall({ home, canonicalDir: skillRoot });
    assert.equal(result.ok, true, result.errors.join("\n"));
    assert.equal(result.links.shared, true);
    assert.equal(result.links.claude, false);
  });
});

test("Windows binary detection includes cmd and bat shims", () => {
  assert.deepEqual(candidateBinaries("claude", "win32"), ["claude", "claude.exe", "claude.cmd", "claude.bat"]);
  assert.deepEqual(candidateBinaries("claude", "darwin"), ["claude", "claude.exe"]);
});

test("Windows install uses npm.cmd", () => {
  assert.equal(npmExecutable("win32"), "npm.cmd");
  assert.equal(npmExecutable("darwin"), "npm");
  assert.equal(npmExecutable("linux"), "npm");
});

test("install replaces a dangling owned-looking symlink", async () => {
  await withHome(async (home) => {
    const dest = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(join(home, ".agents", "skills"), { recursive: true });
    await symlink(join(home, "missing-canonical"), dest);
    const result = await installSkill({ home, canonicalDir: skillRoot, skipDeps: true });
    assert.equal(result.status, "created");
    assert.equal(await readlink(dest), skillRoot);
  });
});

test("install refuses to overwrite a real directory", async () => {
  await withHome(async (home) => {
    const dest = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(dest, { recursive: true });
    await writeFile(join(dest, "SKILL.md"), "foreign\n");
    await assert.rejects(
      installSkill({ home, canonicalDir: skillRoot, skipDeps: true }),
      /foreign|not a symlink|exists/i,
    );
  });
});

test("uninstall removes only the owned symlink", async () => {
  await withHome(async (home) => {
    await installSkill({ home, canonicalDir: skillRoot, skipDeps: true });
    const dest = join(home, ".agents", "skills", "wolfmarkdown");
    const removed = await uninstallSkill({ home, canonicalDir: skillRoot });
    assert.equal(removed, true);
    await assert.rejects(stat(dest));
  });
});
