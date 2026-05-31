export function parseArgs(argv) {
  const tokens = [...argv];
  const command = tokens[0] && !tokens[0].startsWith("--") ? tokens.shift() : "inventory";
  const options = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (key.length === 0) {
      throw new Error("Empty option name is not supported");
    }

    const next = tokens[index + 1];
    if (next == null || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, options };
}

export function requireOption(options, name) {
  const value = options[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required option: --${name}`);
  }
  return value.trim();
}

export function optionalBoolean(options, name) {
  return options[name] === true || options[name] === "true";
}

export function helpText() {
  return `Cypress migration inventory CLI

Usage:
  node tools/cypress-migration/src/cli.mjs inventory --source-root <path> --output-dir <path>
  node tools/cypress-migration/src/cli.mjs --help

Commands:
  inventory   Mine Cypress specs, .feature files, support commands, and fixtures.

Options:
  --source-root <path>   Cypress project/source root to inspect. Required.
  --output-dir <path>    Directory for generated review artifacts. Required.
  --help                 Show this help.

Generated artifacts:
  inventory.json
  inventory.md
  risk-flags.md
  draft-features/*.feature

The CLI writes only under --output-dir and refuses output locations inside Cypress
source directories such as cypress/e2e, cypress/support, and cypress/fixtures.`;
}
