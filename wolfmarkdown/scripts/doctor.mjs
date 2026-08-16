#!/usr/bin/env node

import { homedir } from "node:os";
import { inspectHealth } from "../lib/doctor.mjs";
import { parseFlags, printHelp } from "../lib/cli.mjs";
import { skillRoot } from "../lib/paths.mjs";

async function main(argv) {
  const parsed = parseFlags(argv, ["--json"]);
  if (parsed.help) {
    printHelp("WolfMarkDown doctor", "Usage: node scripts/doctor.mjs [--json]");
    return 0;
  }
  if (parsed.positionals.length > 0) {
    throw new Error("Unexpected arguments.");
  }
  const home = process.env.WOLFMARKDOWN_HOME || process.env.HOME || homedir();
  const health = await inspectHealth({ home, canonicalDir: skillRoot });
  const runtimeOk = Boolean(health.runtimeOk ?? health.runtime.ok);
  const discoveryOk = Boolean(health.discoveryOk ?? health.discovery.ok);
  const overallOk = Boolean(health.overallOk ?? (runtimeOk && discoveryOk));
  if (parsed.flags.json) {
    process.stdout.write(`${JSON.stringify(health, null, 2)}\n`);
  } else {
    const pass = (ok) => (ok ? "Pass" : "Fail");
    const agentLines = (health.agents ?? []).map((agent) => {
      const bits = [agent.acceptance === "pending" ? "Standard-compatible / Acceptance pending" : "Compatible"];
      bits.push(agent.detected ? "Detected" : "Not detected");
      if (agent.status === "Ready") bits.push("Ready");
      else if (agent.status === "Optional compatibility link missing") bits.push(agent.status);
      return `${agent.name}: ${bits.join(" / ")}`;
    });
    const localProcessing = runtimeOk
      ? "Local processing: Available (runtime healthy; discovery is not required for project-local work)"
      : "Local processing: Unavailable (runtime is not healthy)";
    process.stdout.write(
      [
        "WolfMarkDown Doctor",
        `Runtime: ${pass(runtimeOk)}`,
        `Discovery: ${pass(discoveryOk)}`,
        `Overall: ${overallOk ? "PASS" : "FAIL"}`,
        localProcessing,
        "Runtime details",
        `Node.js: ${pass(Boolean(health.runtime.checks.node))}`,
        `Dependencies: ${pass(Boolean(health.runtime.checks.dependencies))}`,
        `Canonical skill: ${pass(Boolean(health.runtime.checks.skillDir && health.runtime.checks.skillMd))}`,
        "Discovery details",
        `Shared Agent Skills: ${health.discovery.checks.shared ? "Ready" : "Missing"}`,
        `Claude Code: ${health.discovery.checks.claude ? "Ready" : "Optional compatibility link missing"}`,
        "Agent Coverage",
        ...agentLines,
        `Result: ${overallOk ? "PASS" : "FAIL"}`,
        "",
      ].join("\n"),
    );
    const errors = [...health.runtime.errors, ...health.discovery.errors];
    if (errors.length > 0) process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
  }
  return overallOk ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  },
);
