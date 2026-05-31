#!/usr/bin/env node

import { parseArgs, requireOption, helpText } from "./args.mjs";
import { buildInventory } from "./parser.mjs";
import { writeMigrationArtifacts } from "./renderers.mjs";

export async function run(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr } = {}) {
  const { command, options } = parseArgs(argv);

  if (options.help === true || command === "help" || command === "--help") {
    stdout.write(`${helpText()}\n`);
    return 0;
  }

  if (command !== "inventory") {
    throw new Error(`Unknown command: ${command}. Run with --help for usage.`);
  }

  const sourceRoot = requireOption(options, "source-root");
  const outputDir = requireOption(options, "output-dir");
  const inventory = await buildInventory({ sourceRoot, outputDir });
  const artifacts = await writeMigrationArtifacts(inventory, { outputDir });

  stdout.write(`Wrote Cypress migration inventory to ${artifacts.inventoryJson}\n`);
  stdout.write(`Wrote Cypress migration markdown to ${artifacts.inventoryMarkdown}\n`);
  stdout.write(`Wrote Cypress migration risk flags to ${artifacts.riskMarkdown}\n`);
  for (const draft of artifacts.draftFeatures) {
    stdout.write(`Wrote Cypress migration draft feature to ${draft.path}\n`);
  }
  return 0;
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
