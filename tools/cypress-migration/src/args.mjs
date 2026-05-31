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
  return `Cypress migration CLI

Usage:
  node tools/cypress-migration/src/cli.mjs inventory --source-root <path> --output-dir <path>
  node tools/cypress-migration/src/cli.mjs risk --source-root <path> --output-dir <path>
  node tools/cypress-migration/src/cli.mjs draft --source-root <path> --output-dir <path>
  node tools/cypress-migration/src/cli.mjs oracle --source-root <path> --output-dir <path> [--port 8790]
  node tools/cypress-migration/src/cli.mjs check --source-root <path> --output-dir <path> --repo-root <path>
  node tools/cypress-migration/src/cli.mjs --help

Commands:
  inventory   Mine Cypress source into inventory.json, inventory.md, risk flags, and draft features.
  risk        Generate reviewable risk flags for hidden setup, fixtures, waits, mocks, aliases, and shared data.
  draft       Generate review-first Cucumber feature sketches under draft-features/.
  oracle      Run the synthetic Cypress oracle with a transient 127.0.0.1:8790 static server and PID-owned cleanup.
  evidence    Map synthetic Cypress tests to migrationdemo Playwright/Cucumber scenarios and visible outcomes.
  check       Run the full Cypress migration check: tool tests, inventory/risk/draft, oracle, evidence, and testMigrationDemo.

Options:
  --source-root <path>       Cypress project/source root to inspect. Required.
  --output-dir <path>        Directory for generated review artifacts. Required.
  --repo-root <path>         Repository root used by check/evidence for Gradle and migrationdemo lookup.
  --port <number>            Loopback port for the synthetic oracle. Defaults to 8790.
  --cypress-status <status>  Evidence status override: passed, failed, or not-run.
  --playwright-status <status> Evidence status override: passed, failed, or not-run.
  --help                     Show this help.

Generated artifacts:
  inventory.json
  inventory.md
  risk-flags.md
  draft-features/*.feature
  oracle-result.json
  oracle-result.md
  evidence-summary.json
  evidence-summary.md

The CLI writes only under --output-dir and refuses output locations inside Cypress
source roots, committed repository source/test paths, docs/, .windsurf/, .codex/,
and test-suite source directories. Use ignored build output such as
build/cypress-migration.

Gradle aggregate:
  ./gradlew :test-suite:cypressMigrationCheck --console=plain --no-daemon -Dheadless=true`;
}
