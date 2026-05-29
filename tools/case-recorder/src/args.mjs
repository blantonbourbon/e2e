export function parseArgs(argv) {
  const values = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (key.length === 0) {
      throw new Error("Empty option name is not supported");
    }

    const next = argv[index + 1];
    if (next == null || next.startsWith("--")) {
      values[key] = true;
      continue;
    }

    values[key] = next;
    index += 1;
  }

  return values;
}

export function requireOption(options, name) {
  const value = options[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required option: --${name}`);
  }
  return value.trim();
}

export function optionalOption(options, name, fallback = undefined) {
  const value = options[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

export function booleanOption(options, name) {
  return options[name] === true || options[name] === "true";
}
