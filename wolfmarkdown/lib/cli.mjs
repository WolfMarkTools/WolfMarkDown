const VALUE_FLAGS = {
  "--integrity-from": "integrityFrom",
  "--receipt": "receipt",
};

function flagName(arg) {
  return arg.slice(2);
}

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
    if (arg.startsWith("-") && arg !== "-" && arg !== "-h") {
      if (!arg.startsWith("--") || !allowed.includes(arg)) {
        throw new Error(`Unknown flag: ${arg}`);
      }
      const valueKey = VALUE_FLAGS[arg];
      if (valueKey) {
        const value = args[index + 1];
        if (!value || value.startsWith("--")) {
          throw new Error(`${arg} requires a file path.`);
        }
        flags[valueKey] = value;
        index += 1;
        continue;
      }
      flags[flagName(arg)] = true;
      continue;
    }
    positionals.push(arg);
  }
  return { flags, positionals };
}
