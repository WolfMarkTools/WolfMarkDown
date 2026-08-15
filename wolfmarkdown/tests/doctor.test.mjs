import assert from "node:assert/strict";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectHealth } from "../lib/doctor.mjs";
import { skillRoot } from "./helpers.mjs";

async function withHome(run) {
  const home = await mkdtemp(join(tmpdir(), "wolfmarkdown-doctor-"));
  try {
    return await run(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

test("healthy runtime plus owned global link passes doctor", async () => {
  await withHome(async (home) => {
    const dest = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(join(home, ".agents", "skills"), { recursive: true });
    await symlink(skillRoot, dest);
    const health = await inspectHealth({ home, canonicalDir: skillRoot });
    assert.equal(health.runtime.ok, true, health.runtime.errors.join("\n"));
    assert.equal(health.discovery.ok, true, health.discovery.errors.join("\n"));
    assert.equal(health.runtime.checks.node, true);
    assert.equal(health.runtime.checks.dependencies, true);
    assert.equal(health.discovery.checks.shared, true);
  });
});

test("missing global link is a discovery failure, not a runtime failure", async () => {
  await withHome(async (home) => {
    const health = await inspectHealth({ home, canonicalDir: skillRoot });
    assert.equal(health.runtime.ok, true, health.runtime.errors.join("\n"));
    assert.equal(health.discovery.ok, false);
    assert.ok(health.discovery.errors.some((error) => /shared agent skills|missing/i.test(error)));
  });
});

test("missing prettier package is a runtime failure", async () => {
  await withHome(async (home) => {
    const fake = join(home, "fake-skill");
    await mkdir(join(fake, "scripts"), { recursive: true });
    await writeFile(join(fake, "SKILL.md"), "---\nname: wolfmarkdown\n---\n");
    await writeFile(join(fake, "package.json"), JSON.stringify({ engines: { node: ">=20" }, dependencies: { prettier: "3.9.6" } }));
    for (const name of ["format-markdown.mjs", "verify-markdown.mjs", "install.mjs", "doctor.mjs"]) {
      await writeFile(join(fake, "scripts", name), "");
    }
    const health = await inspectHealth({ home, canonicalDir: fake });
    assert.equal(health.runtime.ok, false);
    assert.ok(health.runtime.errors.some((error) => /dependenc/i.test(error)));
  });
});

test("missing Claude link does not fail runtime", async () => {
  await withHome(async (home) => {
    const shared = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(join(home, ".agents", "skills"), { recursive: true });
    await symlink(skillRoot, shared);
    const health = await inspectHealth({
      home,
      canonicalDir: skillRoot,
      lookFor: { claude: false, codex: false, cursor: false, grok: false },
    });
    assert.equal(health.runtime.ok, true, health.runtime.errors.join("\n"));
    assert.equal(health.discovery.ok, true, health.discovery.errors.join("\n"));
    assert.equal(health.discovery.checks.claude, false);
    const claude = health.agents.find((agent) => agent.id === "claude");
    assert.ok(claude);
    assert.equal(claude.compatible, true);
    assert.notEqual(claude.status, "Ready");
    assert.equal(health.ok, true);
  });
});

test("absent optional agents are compatible but not detected", async () => {
  await withHome(async (home) => {
    const health = await inspectHealth({
      home,
      canonicalDir: skillRoot,
      lookFor: {
        claude: false,
        codex: false,
        cursor: false,
        grok: false,
        opencode: false,
        gemini: false,
        antigravity: false,
        copilot: false,
      },
    });
    assert.equal(health.runtime.ok, true);
    assert.equal(health.ok, true);
    const copilot = health.agents.find((agent) => agent.id === "copilot");
    assert.equal(copilot.compatible, true);
    assert.equal(copilot.acceptance, "pending");
    assert.equal(copilot.detected, false);
    assert.equal(copilot.tier, 2);
    const antigravity = health.agents.find((agent) => agent.id === "antigravity");
    assert.equal(antigravity.compatible, true);
    assert.equal(antigravity.acceptance, "pending");
    assert.equal(antigravity.tier, 1);
    const grok = health.agents.find((agent) => agent.id === "grok");
    assert.equal(grok.acceptance, "tested");
  });
});

test("doctor does not create a global link", async () => {
  await withHome(async (home) => {
    await inspectHealth({ home, canonicalDir: skillRoot });
    await assert.rejects(import("node:fs/promises").then(({ stat }) => stat(join(home, ".agents", "skills", "wolfmarkdown"))));
  });
});
