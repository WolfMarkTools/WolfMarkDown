export function printHelp(name, usage) {
  process.stdout.write(`${name}\n\n${usage}\n`);
}

export function parseFlags(args, allowed) {
  if (args.includes("--help") || args.includes("-h")) return { help: true };
  const flags = {};
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--mode") {
      throw new Error("--mode is not supported in v1.");
    }
    if (arg.startsWith("--")) {
      if (!allowed.includes(arg)) {
        throw new Error(`Unknown flag: ${arg}`);
      }
      if (arg === "--integrity-from") {
        const value = args[index + 1];
        if (!value || value.startsWith("--")) {
          throw new Error("--integrity-from requires a file path.");
        }
        flags.integrityFrom = value;
        index += 1;
        continue;
      }
      flags[arg.slice(2)] = true;
      continue;
    }
    positionals.push(arg);
  }
  return { flags, positionals };
}
