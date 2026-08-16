import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectHealth, mergeDetection } from "../lib/doctor.mjs";
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
    assert.equal(health.runtimeOk, true);
    assert.equal(health.discoveryOk, true);
    assert.equal(health.overallOk, true);
    assert.equal(health.ok, health.overallOk);
    assert.equal(health.ok, true);
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
    assert.equal(health.runtimeOk, true);
    assert.equal(health.discoveryOk, false);
    assert.equal(health.overallOk, false);
    assert.equal(health.ok, health.overallOk);
    assert.equal(health.ok, false);
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
    assert.equal(health.runtimeOk, false);
    assert.equal(health.overallOk, false);
    assert.equal(health.ok, health.overallOk);
    assert.equal(health.ok, false);
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
    assert.equal(health.runtimeOk, true);
    assert.equal(health.ok, health.overallOk);
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
    assert.equal(health.runtimeOk, true);
    assert.equal(health.discoveryOk, false);
    assert.equal(health.ok, health.overallOk);
    assert.equal(health.ok, false);
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

test("directory detection is not overwritten by a missing PATH binary", async () => {
  await withHome(async (home) => {
    await mkdir(join(home, ".cursor"));
    const emptyPath = join(home, "empty-path");
    await mkdir(emptyPath);
    const previous = process.env.PATH;
    process.env.PATH = emptyPath;
    try {
      const health = await inspectHealth({ home, canonicalDir: skillRoot });
      const cursor = health.agents.find((agent) => agent.id === "cursor");
      assert.equal(cursor.detected, true);
      assert.equal(cursor.status, "Detected");
    } finally {
      process.env.PATH = previous;
    }
  });
});

test("installer-created Claude directory is not treated as Claude Code", async () => {
  await withHome(async (home) => {
    await mkdir(join(home, ".claude", "skills"), { recursive: true });
    const emptyPath = join(home, "empty-path");
    await mkdir(emptyPath);
    const previous = process.env.PATH;
    process.env.PATH = emptyPath;
    try {
      const health = await inspectHealth({ home, canonicalDir: skillRoot });
      const claude = health.agents.find((agent) => agent.id === "claude");
      assert.equal(claude.detected, false);
    } finally {
      process.env.PATH = previous;
    }
  });
});

test("Antigravity is not Ready when project root was not inspected and shared is missing", async () => {
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
        antigravity: true,
        copilot: false,
      },
    });
    const antigravity = health.agents.find((agent) => agent.id === "antigravity");
    assert.equal(antigravity.detected, true);
    assert.equal(antigravity.discoveryReady, false);
    assert.notEqual(antigravity.status, "Ready");
    assert.equal(health.discovery.ok, false);
    assert.equal(health.runtimeOk, true);
    assert.equal(health.ok, health.overallOk);
    assert.equal(health.ok, false);
  });
});

test("mergeDetection keeps a directory hit when the binary is absent", () => {
  assert.deepEqual(mergeDetection({ cursor: true, grok: false }, { cursor: false, grok: true }), {
    cursor: true,
    grok: true,
  });
});

test("doctor text output does not label an undetected agent Ready", async () => {
  await withHome(async (home) => {
    const shared = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(join(home, ".agents", "skills"), { recursive: true });
    await symlink(skillRoot, shared);
    const binDir = join(home, "bin");
    await mkdir(binDir);
    await writeFile(join(binDir, "grok"), "#!/bin/sh\n");
    await writeFile(join(binDir, "claude"), "#!/bin/sh\n");
    const ran = spawnSync(process.execPath, [join(skillRoot, "scripts", "doctor.mjs")], {
      encoding: "utf8",
      env: { ...process.env, WOLFMARKDOWN_HOME: home, HOME: home, PATH: binDir },
    });
    assert.match(ran.stdout, /Grok Build: Compatible \/ Detected \/ Ready/);
    assert.match(ran.stdout, /Claude Code: Compatible \/ Detected \/ Optional compatibility link missing/);
    assert.match(ran.stdout, /Codex: Compatible \/ Not detected(?:\n|$)/);
    assert.doesNotMatch(ran.stdout, /Codex:.*Ready/);
    assert.match(ran.stdout, /Result: PASS/);
    assert.equal(ran.status, 0);
  });
});

test("doctor text Result is FAIL when discovery is missing", async () => {
  await withHome(async (home) => {
    const ran = spawnSync(process.execPath, [join(skillRoot, "scripts", "doctor.mjs")], {
      encoding: "utf8",
      env: { ...process.env, WOLFMARKDOWN_HOME: home, HOME: home },
    });
    assert.match(ran.stdout, /^Runtime: Pass$/mu);
    assert.match(ran.stdout, /^Discovery: Fail$/mu);
    assert.match(ran.stdout, /^Overall: FAIL$/mu);
    assert.match(ran.stdout, /Local processing: Available/);
    assert.match(ran.stdout, /Result: FAIL/);
    assert.notEqual(ran.status, 0);
  });
});

test("doctor JSON and text describe the same healthy runtime with missing discovery", async () => {
  await withHome(async (home) => {
    const env = { ...process.env, WOLFMARKDOWN_HOME: home, HOME: home };
    const jsonRun = spawnSync(process.execPath, [join(skillRoot, "scripts", "doctor.mjs"), "--json"], {
      encoding: "utf8",
      env,
    });
    const payload = JSON.parse(jsonRun.stdout);
    assert.equal(payload.runtimeOk, true);
    assert.equal(payload.discoveryOk, false);
    assert.equal(payload.overallOk, false);
    assert.equal(payload.ok, payload.overallOk);
    assert.equal(payload.ok, false);
    assert.notEqual(jsonRun.status, 0);

    const textRun = spawnSync(process.execPath, [join(skillRoot, "scripts", "doctor.mjs")], {
      encoding: "utf8",
      env,
    });
    assert.match(textRun.stdout, /^Runtime: Pass$/mu);
    assert.match(textRun.stdout, /^Discovery: Fail$/mu);
    assert.match(textRun.stdout, /^Overall: FAIL$/mu);
    assert.match(textRun.stdout, /Result: FAIL/);
    assert.equal(textRun.status, jsonRun.status);
  });
});

test("doctor JSON and text agree when runtime and discovery are healthy", async () => {
  await withHome(async (home) => {
    const dest = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(join(home, ".agents", "skills"), { recursive: true });
    await symlink(skillRoot, dest);
    const env = { ...process.env, WOLFMARKDOWN_HOME: home, HOME: home };
    const jsonRun = spawnSync(process.execPath, [join(skillRoot, "scripts", "doctor.mjs"), "--json"], {
      encoding: "utf8",
      env,
    });
    const payload = JSON.parse(jsonRun.stdout);
    assert.equal(payload.runtimeOk, true);
    assert.equal(payload.discoveryOk, true);
    assert.equal(payload.overallOk, true);
    assert.equal(payload.ok, payload.overallOk);
    assert.equal(payload.ok, true);
    assert.equal(jsonRun.status, 0);

    const textRun = spawnSync(process.execPath, [join(skillRoot, "scripts", "doctor.mjs")], {
      encoding: "utf8",
      env,
    });
    assert.match(textRun.stdout, /^Runtime: Pass$/mu);
    assert.match(textRun.stdout, /^Discovery: Pass$/mu);
    assert.match(textRun.stdout, /^Overall: PASS$/mu);
    assert.match(textRun.stdout, /Result: PASS/);
    assert.equal(textRun.status, 0);
  });
});

test("mismatched discovery target is a discovery failure with healthy runtime", async () => {
  await withHome(async (home) => {
    const dest = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(dest, { recursive: true });
    await writeFile(join(dest, "SKILL.md"), "---\nname: other\n---\n");
    const health = await inspectHealth({ home, canonicalDir: skillRoot });
    assert.equal(health.runtimeOk, true);
    assert.equal(health.discoveryOk, false);
    assert.equal(health.overallOk, false);
    assert.equal(health.ok, health.overallOk);
    assert.equal(health.ok, false);
    assert.ok(health.discovery.errors.some((error) => /points at|not an owned|expected/i.test(error)));
  });
});

function localProcessingAllowed(health) {
  return health.runtimeOk === true;
}

test("ok always equals overallOk and preflight follows runtimeOk", async () => {
  await withHome(async (home) => {
    const missing = await inspectHealth({ home, canonicalDir: skillRoot });
    assert.equal(missing.ok, missing.overallOk);
    assert.equal(missing.runtimeOk, true);
    assert.equal(missing.ok, false);
    assert.equal(localProcessingAllowed(missing), true);

    const dest = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(join(home, ".agents", "skills"), { recursive: true });
    await symlink(skillRoot, dest);
    const healthy = await inspectHealth({ home, canonicalDir: skillRoot });
    assert.equal(healthy.ok, healthy.overallOk);
    assert.equal(healthy.ok, true);
    assert.equal(localProcessingAllowed(healthy), true);
  });
});

test("runtime failure is a hard local-processing failure even if discovery is healthy", async () => {
  await withHome(async (home) => {
    const fake = join(home, "fake-skill");
    await mkdir(join(fake, "scripts"), { recursive: true });
    await writeFile(join(fake, "SKILL.md"), "---\nname: wolfmarkdown\n---\n");
    await writeFile(join(fake, "package.json"), JSON.stringify({ engines: { node: ">=20" }, dependencies: { prettier: "3.9.6" } }));
    for (const name of ["format-markdown.mjs", "verify-markdown.mjs", "install.mjs", "doctor.mjs"]) {
      await writeFile(join(fake, "scripts", name), "");
    }
    const dest = join(home, ".agents", "skills", "wolfmarkdown");
    await mkdir(join(home, ".agents", "skills"), { recursive: true });
    await symlink(fake, dest);
    const health = await inspectHealth({ home, canonicalDir: fake });
    assert.equal(health.runtimeOk, false);
    assert.equal(health.discoveryOk, true);
    assert.equal(health.overallOk, false);
    assert.equal(health.ok, health.overallOk);
    assert.equal(health.ok, false);
    assert.equal(localProcessingAllowed(health), false);
  });
});

test("doctor does not create a global link", async () => {
  await withHome(async (home) => {
    await inspectHealth({ home, canonicalDir: skillRoot });
    await assert.rejects(import("node:fs/promises").then(({ stat }) => stat(join(home, ".agents", "skills", "wolfmarkdown"))));
  });
});
