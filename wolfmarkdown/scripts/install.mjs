#!/usr/bin/env node

import { homedir } from "node:os";
import { parseFlags, printHelp } from "../lib/cli.mjs";
import { checkInstall, installSkill, uninstallSkill } from "../lib/install-targets.mjs";
import { skillRoot } from "../lib/paths.mjs";

async function main(argv) {
  const parsed = parseFlags(argv, ["--check", "--uninstall"]);
  if (parsed.help) {
    printHelp(
      "WolfMarkDown installer",
      "Usage: node scripts/install.mjs [--check] [--uninstall]",
    );
    return 0;
  }
  if (parsed.positionals.length > 0) {
    throw new Error("Unexpected arguments.");
  }
  const home = process.env.WOLFMARKDOWN_HOME || process.env.HOME || homedir();
  if (parsed.flags.check) {
    const result = await checkInstall({ home, canonicalDir: skillRoot });
    process.stdout.write(`shared: ${result.destination}\n`);
    process.stdout.write(`claude: ${result.links?.claude ? "ready" : "missing"}\n`);
    if (!result.ok) {
      process.stderr.write(`${result.errors.join("\n")}\n`);
      return 1;
    }
    process.stdout.write("unchanged\n");
    return 0;
  }
  if (parsed.flags.uninstall) {
    const removed = await uninstallSkill({ home, canonicalDir: skillRoot });
    process.stdout.write(removed ? "removed\n" : "not installed\n");
    return 0;
  }
  const result = await installSkill({ home, canonicalDir: skillRoot });
  process.stdout.write(`shared ${result.destination}: ${result.statuses?.shared ?? result.status}\n`);
  process.stdout.write(`claude: ${result.statuses?.claude ?? "skipped"}\n`);
  return 0;
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
