import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { slug, unique } from "./utils.mjs";

export async function writeMigrationArtifacts(inventory, { outputDir }) {
  const resolvedOutputDir = resolve(outputDir);
  const draftDir = join(resolvedOutputDir, "draft-features");
  await mkdir(draftDir, { recursive: true });

  const inventoryJson = join(resolvedOutputDir, "inventory.json");
  const inventoryMarkdown = join(resolvedOutputDir, "inventory.md");
  const riskMarkdown = join(resolvedOutputDir, "risk-flags.md");
  const draftFeatures = renderDraftFeatures(inventory).map((draft) => ({
    ...draft,
    path: join(draftDir, draft.fileName),
  }));

  await writeFile(inventoryJson, `${JSON.stringify(inventory, null, 2)}\n`);
  await writeFile(inventoryMarkdown, renderInventoryMarkdown(inventory));
  await writeFile(riskMarkdown, renderRiskMarkdown(inventory));
  for (const draft of draftFeatures) {
    await writeFile(draft.path, draft.content);
  }

  return {
    outputDir: resolvedOutputDir,
    inventoryJson,
    inventoryMarkdown,
    riskMarkdown,
    draftFeatures,
  };
}

export function renderInventoryMarkdown(inventory) {
  const lines = [
    "# Cypress Migration Inventory",
    "",
    `Source root: \`${inventory.sourceRoot}\``,
    "",
    "## Inputs",
    "",
    `- Cypress configs: ${formatList(inventory.inputs.configFiles.map((config) => config.path))}`,
    `- Cypress specs: ${formatList(inventory.inputs.specFiles)}`,
    `- Cypress feature files: ${formatList(inventory.inputs.featureFiles)}`,
    `- Support files: ${formatList(inventory.inputs.supportFiles)}`,
    `- Fixture files: ${formatList(inventory.inputs.fixtureFiles)}`,
    "",
  ];

  if (inventory.customCommands.length > 0) {
    lines.push("## Custom Commands", "");
    for (const command of inventory.customCommands) {
      lines.push(`### \`${command.name}\``);
      lines.push("");
      lines.push(`- Definition: \`${command.path}:${command.line}\``);
      lines.push(`- Fixture dependencies: ${formatList(command.fixtureDependencies)}`);
      lines.push(`- State mutations: ${formatList(command.stateMutations.map((mutation) => mutation.command))}`);
      lines.push(`- Navigation targets: ${formatList(command.visits.map((visit) => visit.target))}`);
      lines.push(`- Actions: ${formatSignalList(command.actions)}`);
      lines.push(`- Assertions: ${formatAssertionList(command.assertions)}`);
      lines.push("");
    }
  }

  lines.push("## Cypress Feature Inputs", "");
  if (inventory.cypressFeatures.length === 0) {
    lines.push("_No Cypress `.feature` files found._", "");
  } else {
    for (const feature of inventory.cypressFeatures) {
      lines.push(`### ${feature.name}`);
      lines.push("");
      lines.push(`- Source: \`${feature.path}\``);
      lines.push(`- Candidate target: \`${feature.targetCandidate.featurePath}\``);
      if (feature.background.steps.length > 0) {
        lines.push("- Background:");
        for (const step of feature.background.steps) {
          lines.push(`  - ${step}`);
        }
      }
      lines.push("- Scenarios:");
      for (const scenario of feature.scenarios) {
        lines.push(`  - ${scenario.title}`);
      }
      lines.push("");
    }
  }

  lines.push("## Spec Inventory", "");
  for (const spec of inventory.specs) {
    lines.push(`### \`${spec.path}\``);
    lines.push("");
    lines.push(`- Suites: ${formatList(spec.suites)}`);
    for (const test of spec.tests) {
      lines.push("");
      lines.push(`#### ${test.title}`);
      lines.push("");
      lines.push(`- Candidate target: \`${test.candidateTarget.featurePath}\``);
      lines.push(`- Fixtures: ${formatList(test.fixtures.map((fixture) => fixture.name))}`);
      lines.push(`- Custom commands: ${formatList(test.customCommandUsages.map((usage) => usage.name))}`);
      lines.push(`- Visits: ${formatList(test.visits.map((visit) => visit.target))}`);
      lines.push(`- Actions: ${formatSignalList(test.actions)}`);
      lines.push(`- Assertions: ${formatAssertionList(test.assertions)}`);
      if (test.relatedFeatureScenarios.length > 0) {
        lines.push(
          `- Cypress feature cross-reference: ${formatList(test.relatedFeatureScenarios.map((scenario) => `${scenario.path} :: ${scenario.title}`))}`,
        );
      }
      if (test.reviewItems.length > 0) {
        lines.push("- Review items:");
        for (const item of test.reviewItems) {
          lines.push(`  - **${item.type}**: ${item.message} ${item.suggestion}`);
        }
      }
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export function renderRiskMarkdown(inventory) {
  const lines = [
    "# Cypress Migration Risk Flags",
    "",
    "Generated risks are review items. They are not proof that a flow cannot be migrated.",
    "",
  ];

  if (inventory.risks.length === 0) {
    lines.push("_No migration risks detected._", "");
    return `${lines.join("\n")}\n`;
  }

  const risksByType = groupBy(inventory.risks, (risk) => risk.type);
  for (const [type, risks] of risksByType.entries()) {
    lines.push(`## ${type}`, "");
    for (const risk of risks) {
      const context = risk.context;
      const title = context.testTitle ? ` :: ${context.testTitle}` : "";
      const command = context.commandName ? ` (${context.commandName})` : "";
      lines.push(`- **${risk.severity}** \`${context.specPath}:${context.line}\`${title}${command}`);
      lines.push(`  - ${risk.message}`);
      lines.push(`  - Suggested handling: ${risk.suggestion}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export function renderDraftFeatures(inventory) {
  const featureDrafts = new Map();

  for (const sourceFeature of inventory.cypressFeatures) {
    const candidate = sourceFeature.targetCandidate;
    featureDrafts.set(candidate.feature, {
      fileName: `${candidate.feature}.feature`,
      content: renderFeatureBackedDraft(inventory, sourceFeature),
    });
  }

  for (const spec of inventory.specs) {
    for (const test of spec.tests) {
      if (featureDrafts.has(test.candidateTarget.feature)) {
        continue;
      }
      featureDrafts.set(test.candidateTarget.feature, {
        fileName: `${test.candidateTarget.feature}.feature`,
        content: renderSpecBackedDraft(inventory, spec, test.candidateTarget),
      });
    }
  }

  return [...featureDrafts.values()].sort((left, right) => left.fileName.localeCompare(right.fileName));
}

function renderFeatureBackedDraft(inventory, sourceFeature) {
  const relatedTests = inventory.specs.flatMap((spec) =>
    spec.tests.filter((test) =>
      test.relatedFeatureScenarios.some((scenario) => scenario.path === sourceFeature.path),
    ),
  );
  const reviewLines = reviewCommentLines(relatedTests);
  const lines = [
    "# REVIEW: Generated draft; do not promote without manual migration review.",
    `# Source Cypress feature: ${sourceFeature.path}`,
    ...reviewLines,
    `Feature: ${sourceFeature.name}`,
    "",
  ];

  if (sourceFeature.background.steps.length > 0) {
    lines.push("  Background:");
    for (const step of sourceFeature.background.steps) {
      lines.push(`    ${step}`);
    }
    lines.push("");
  }

  for (const scenario of sourceFeature.scenarios) {
    lines.push(`  Scenario: ${scenario.title}`);
    for (const step of scenario.steps) {
      lines.push(`    ${step}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}`;
}

function renderSpecBackedDraft(inventory, spec, candidate) {
  const tests = spec.tests.filter((test) => test.candidateTarget.feature === candidate.feature);
  const lines = [
    "# REVIEW: Generated draft; do not promote without manual migration review.",
    `# Source Cypress spec: ${spec.path}`,
    ...reviewCommentLines(tests),
    `Feature: ${humanize(candidate.feature)}`,
    "",
  ];

  const hiddenSetup = tests.some((test) => test.customCommandUsages.length > 0);
  if (hiddenSetup) {
    lines.push("  Background:");
    lines.push("    Given the migrated Cypress setup is reviewed");
    lines.push("");
  }

  for (const test of tests) {
    lines.push(`  Scenario: ${sentenceCase(test.title)}`);
    lines.push(`    When the reviewer migrates Cypress test "${test.title}"`);
    lines.push("    Then the migrated scenario should preserve the Cypress user-visible assertions");
    lines.push("");
  }

  return `${lines.join("\n")}`;
}

function reviewCommentLines(tests) {
  const commands = uniqueInOrder(tests.flatMap((test) => test.customCommandUsages.map((usage) => usage.name)));
  const fixtures = uniqueInOrder(tests.flatMap((test) => test.fixtures.map((fixture) => fixture.name)));
  const unsupported = uniqueInOrder(tests.flatMap((test) => test.unsupportedConstructs.map((item) => item.command)));
  const lines = [];

  for (const command of commands) {
    lines.push(`# REVIEW: Hidden Cypress setup via custom command \`${command}\` must become explicit Background/helper behavior.`);
  }
  if (fixtures.length > 0) {
    lines.push(`# REVIEW: Fixture-backed data requires review: ${fixtures.map((fixture) => `\`${fixture}\``).join(", ")}.`);
  }
  if (unsupported.length > 0) {
    lines.push(`# REVIEW: Unsupported Cypress constructs require manual handling: ${unsupported.map((item) => `\`${item}\``).join(", ")}.`);
  }
  return lines;
}

function uniqueInOrder(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (value == null || value === "" || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function formatList(values) {
  const normalized = unique(values);
  if (normalized.length === 0) {
    return "_none_";
  }
  return normalized.map((value) => `\`${value}\``).join(", ");
}

function formatSignalList(signals) {
  if (signals.length === 0) {
    return "_none_";
  }
  return signals
    .map((signal) => {
      const selector = signal.selector ? ` ${signal.selector}` : "";
      const text = signal.text ? ` "${signal.text}"` : "";
      return `\`${signal.command}${selector}${text}\``;
    })
    .join(", ");
}

function formatAssertionList(assertions) {
  if (assertions.length === 0) {
    return "_none_";
  }
  return assertions
    .map((assertion) => {
      const selector = assertion.selector ? ` ${assertion.selector}` : "";
      const expected = assertion.expected ?? assertion.expectedExpression ?? assertion.text ?? "";
      return `\`${assertion.subject}${selector} ${assertion.assertion ?? assertion.command} ${expected}\``;
    })
    .join(", ");
}

function groupBy(values, keyFn) {
  const grouped = new Map();
  for (const value of values) {
    const key = keyFn(value);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(value);
  }
  return grouped;
}

function humanize(value) {
  return sentenceCase(slug(value).replace(/-/g, " "));
}

function sentenceCase(value) {
  const trimmed = String(value).trim();
  if (trimmed.length === 0) {
    return "";
  }
  return `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
}
