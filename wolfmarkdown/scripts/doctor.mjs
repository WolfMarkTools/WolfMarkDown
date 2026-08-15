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
  if (parsed.flags.json) {
    process.stdout.write(`${JSON.stringify(health, null, 2)}\n`);
  } else {
    const pass = (ok) => (ok ? "Pass" : "Fail");
    const agentLines = (health.agents ?? []).map((agent) => {
      const bits = ["Compatible"];
      bits.push(agent.detected ? "Detected" : "Not detected");
      if (agent.discoveryReady) bits.push("Ready");
      else if (agent.status === "Optional compatibility link missing") bits.push(agent.status);
      return `${agent.name}: ${bits.join(" / ")}`;
    });
    process.stdout.write(
      [
        "WolfMarkDown Doctor",
        "Runtime",
        `Node.js: ${pass(Boolean(health.runtime.checks.node))}`,
        `Dependencies: ${pass(Boolean(health.runtime.checks.dependencies))}`,
        `Canonical skill: ${pass(Boolean(health.runtime.checks.skillDir && health.runtime.checks.skillMd))}`,
        "Discovery",
        `Shared Agent Skills: ${health.discovery.checks.shared ? "Ready" : "Missing"}`,
        `Claude Code: ${health.discovery.checks.claude ? "Ready" : "Optional compatibility link missing"}`,
        "Agent Coverage",
        ...agentLines,
        `Result: ${health.ok ? "PASS" : "FAIL"}`,
        "",
      ].join("\n"),
    );
    const errors = [...health.runtime.errors, ...health.discovery.errors];
    if (errors.length > 0) process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
  }
  return health.runtime.ok && health.discovery.ok ? 0 : 1;
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
