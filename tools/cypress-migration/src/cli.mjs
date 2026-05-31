#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, requireOption, helpText } from "./args.mjs";
import { writeEvidenceSummary } from "./evidence.mjs";
import { runProcess, runSyntheticOracle } from "./oracle.mjs";
import { buildInventory } from "./parser.mjs";
import { writeMigrationArtifacts } from "./renderers.mjs";

export async function run(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr } = {}) {
  const { command, options } = parseArgs(argv);

  if (options.help === true || command === "help" || command === "--help") {
    stdout.write(`${helpText()}\n`);
    return 0;
  }

  if (["inventory", "risk", "draft"].includes(command)) {
    const { artifacts } = await generateMigrationArtifacts(options);
    writeArtifactOutput(command, artifacts, stdout);
    return 0;
  }

  if (command === "oracle") {
    return runOracleCommand(options, stdout);
  }

  if (command === "evidence") {
    return runEvidenceCommand(options, stdout);
  }

  if (command === "check") {
    return runCheckCommand(options, stdout, stderr);
  }

  throw new Error(`Unknown command: ${command}. Run with --help for usage.`);
}

async function generateMigrationArtifacts(options) {
  const sourceRoot = requireOption(options, "source-root");
  const outputDir = requireOption(options, "output-dir");
  const inventory = await buildInventory({ sourceRoot, outputDir });
  const artifacts = await writeMigrationArtifacts(inventory, { outputDir });
  return { inventory, artifacts };
}

function writeArtifactOutput(command, artifacts, stdout) {
  if (command === "inventory") {
    stdout.write(`Wrote Cypress migration inventory to ${artifacts.inventoryJson}\n`);
    stdout.write(`Wrote Cypress migration markdown to ${artifacts.inventoryMarkdown}\n`);
    stdout.write(`Wrote Cypress migration risk flags to ${artifacts.riskMarkdown}\n`);
    for (const draft of artifacts.draftFeatures) {
      stdout.write(`Wrote Cypress migration draft feature to ${draft.path}\n`);
    }
    return;
  }

  if (command === "risk") {
    stdout.write(`Wrote Cypress migration risk flags to ${artifacts.riskMarkdown}\n`);
    stdout.write(`Inventory context: ${artifacts.inventoryJson}\n`);
    return;
  }

  if (command === "draft") {
    for (const draft of artifacts.draftFeatures) {
      stdout.write(`Wrote Cypress migration draft feature to ${draft.path}\n`);
    }
    stdout.write(`Inventory context: ${artifacts.inventoryJson}\n`);
  }
}

async function runOracleCommand(options, stdout) {
  const { inventory, artifacts } = await generateMigrationArtifacts(options);
  const outputDir = requireOption(options, "output-dir");
  const sourceRoot = requireOption(options, "source-root");
  const port = optionalPort(options);
  const oracle = await runSyntheticOracle({ sourceRoot, outputDir, port });
  const evidence = await writeEvidenceSummary(inventory, {
    outputDir,
    repoRoot: optionalPath(options, "repo-root") ?? defaultRepoRoot(),
    sourceRoot,
    cypressStatus: oracle.status,
    playwrightStatus: optionalStatus(options, "playwright-status", "not-run"),
    oracleEvidencePath: oracle.evidenceJsonPath,
  });

  stdout.write(`Wrote Cypress migration inventory to ${artifacts.inventoryJson}\n`);
  stdout.write(`Ran synthetic Cypress oracle on ${oracle.baseUrl} with server PID ${oracle.server.pid}\n`);
  stdout.write(`Stopped synthetic Cypress oracle server PID ${oracle.cleanup.stoppedOwnedPid}; port released=${oracle.cleanup.portReleased}\n`);
  stdout.write(`Wrote synthetic Cypress oracle evidence to ${oracle.evidenceJsonPath}\n`);
  stdout.write(`Wrote Cypress/Playwright migration evidence summary to ${evidence.jsonPath}\n`);
  return oracle.exitCode;
}

async function runEvidenceCommand(options, stdout) {
  const { inventory } = await generateMigrationArtifacts(options);
  const outputDir = requireOption(options, "output-dir");
  const evidence = await writeEvidenceSummary(inventory, {
    outputDir,
    repoRoot: optionalPath(options, "repo-root") ?? defaultRepoRoot(),
    sourceRoot: requireOption(options, "source-root"),
    cypressStatus: optionalStatus(options, "cypress-status", "not-run"),
    playwrightStatus: optionalStatus(options, "playwright-status", "not-run"),
    oracleEvidencePath: join(resolve(outputDir), "oracle-result.json"),
  });

  stdout.write(`Wrote Cypress/Playwright migration evidence summary to ${evidence.jsonPath}\n`);
  stdout.write(`Wrote Cypress/Playwright migration evidence markdown to ${evidence.markdownPath}\n`);
  return 0;
}

async function runCheckCommand(options, stdout, stderr) {
  const sourceRoot = requireOption(options, "source-root");
  const outputDir = requireOption(options, "output-dir");
  const repoRoot = optionalPath(options, "repo-root") ?? defaultRepoRoot();
  const toolRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

  stdout.write("Running Cypress migration tool tests...\n");
  const toolTest = await runProcess(npmExecutable, ["test"], { cwd: toolRoot });
  stdout.write(toolTest.stdout);
  stderr.write(toolTest.stderr);
  if (toolTest.exitCode !== 0) {
    return toolTest.exitCode;
  }

  const { inventory, artifacts } = await generateMigrationArtifacts(options);
  stdout.write(`Wrote Cypress migration inventory to ${artifacts.inventoryJson}\n`);
  stdout.write(`Wrote Cypress migration risk flags to ${artifacts.riskMarkdown}\n`);
  for (const draft of artifacts.draftFeatures) {
    stdout.write(`Wrote Cypress migration draft feature to ${draft.path}\n`);
  }

  const oracle = await runSyntheticOracle({ sourceRoot, outputDir, port: optionalPort(options) });
  stdout.write(`Ran synthetic Cypress oracle on ${oracle.baseUrl} with status ${oracle.status}\n`);
  if (oracle.exitCode !== 0) {
    await writeEvidenceSummary(inventory, {
      outputDir,
      repoRoot,
      sourceRoot,
      cypressStatus: oracle.status,
      playwrightStatus: "not-run",
      oracleEvidencePath: oracle.evidenceJsonPath,
    });
    return oracle.exitCode;
  }

  stdout.write("Running Playwright/Cucumber migrationdemo validation...\n");
  const migrationDemo = await runProcess(gradlew, [
    ":test-suite:testMigrationDemo",
    "--console=plain",
    "--no-daemon",
    "-Dheadless=true",
  ], {
    cwd: repoRoot,
  });
  stdout.write(migrationDemo.stdout);
  stderr.write(migrationDemo.stderr);

  const playwrightStatus = migrationDemo.exitCode === 0 ? "passed" : "failed";
  const evidence = await writeEvidenceSummary(inventory, {
    outputDir,
    repoRoot,
    sourceRoot,
    cypressStatus: oracle.status,
    playwrightStatus,
    oracleEvidencePath: oracle.evidenceJsonPath,
  });
  stdout.write(`Wrote Cypress/Playwright migration evidence summary to ${evidence.jsonPath}\n`);

  return migrationDemo.exitCode;
}

function optionalPort(options) {
  const rawPort = options.port;
  if (rawPort == null || rawPort === true) {
    return 8790;
  }

  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid --port value: ${rawPort}`);
  }
  return port;
}

function optionalPath(options, name) {
  const value = options[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function optionalStatus(options, name, defaultValue) {
  const value = options[name];
  if (value == null || value === true) {
    return defaultValue;
  }
  if (!["passed", "failed", "not-run"].includes(value)) {
    throw new Error(`Invalid --${name} value: ${value}. Expected passed, failed, or not-run.`);
  }
  return value;
}

function defaultRepoRoot() {
  return resolve(join(dirname(fileURLToPath(import.meta.url)), "../../.."));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`Error: ${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
