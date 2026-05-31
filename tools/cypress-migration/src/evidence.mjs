import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { slug, unique } from "./utils.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationDemoFeaturePath = "test-suite/src/test/resources/features/migrationdemo/catalog.feature";

export async function writeEvidenceSummary(inventory, {
  outputDir,
  repoRoot = resolve(join(currentDir, "../../..")),
  sourceRoot = inventory.sourceRoot,
  cypressStatus = "not-run",
  playwrightStatus = "not-run",
  oracleEvidencePath = null,
  migrationDemoCommand = "./gradlew :test-suite:testMigrationDemo --console=plain --no-daemon -Dheadless=true",
} = {}) {
  if (typeof outputDir !== "string" || outputDir.trim().length === 0) {
    throw new Error("Missing required option: --output-dir");
  }

  const resolvedOutputDir = resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });

  const summary = await buildEvidenceSummary(inventory, {
    repoRoot,
    sourceRoot,
    cypressStatus,
    playwrightStatus,
    oracleEvidencePath,
    migrationDemoCommand,
  });
  const jsonPath = join(resolvedOutputDir, "evidence-summary.json");
  const markdownPath = join(resolvedOutputDir, "evidence-summary.md");

  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(markdownPath, renderEvidenceMarkdown(summary));

  return {
    summary,
    jsonPath,
    markdownPath,
  };
}

export async function buildEvidenceSummary(inventory, {
  repoRoot,
  sourceRoot,
  cypressStatus,
  playwrightStatus,
  oracleEvidencePath,
  migrationDemoCommand,
}) {
  const featureScenarios = await readMigrationDemoScenarios(repoRoot);
  const fixtureValues = await readFixtureValues(sourceRoot);
  const mappings = inventory.specs.flatMap((spec) =>
    spec.tests.map((test) => {
      const targetScenario = findTargetScenario(test, featureScenarios);
      const expectedUrl = expectedUrlFor(test, fixtureValues);
      const visibleOutcomes = visibleOutcomesFor(test, fixtureValues);

      return {
        cypress: {
          specPath: spec.path,
          testTitle: test.title,
          fullTitle: test.fullTitle,
          cypressFeatureScenario: test.relatedFeatureScenarios[0]?.title ?? null,
        },
        playwright: {
          featurePath: migrationDemoFeaturePath,
          scenario: targetScenario?.title ?? null,
          line: targetScenario?.line ?? null,
        },
        expectedUrl,
        visibleOutcomes,
        status: {
          cypressOracle: cypressStatus,
          playwrightMigrationDemo: playwrightStatus,
          agreement: agreementStatus(cypressStatus, playwrightStatus),
        },
      };
    }),
  );

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot: inventory.sourceRoot,
    oracleEvidencePath,
    migrationDemoCommand,
    statuses: {
      cypressOracle: cypressStatus,
      playwrightMigrationDemo: playwrightStatus,
      agreement: agreementStatus(cypressStatus, playwrightStatus),
    },
    mappings,
  };
}

async function readMigrationDemoScenarios(repoRoot) {
  const featureText = await readFile(join(repoRoot, migrationDemoFeaturePath), "utf8");
  const scenarios = [];
  const lines = featureText.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].trim().match(/^Scenario(?: Outline)?:\s*(.+)$/);
    if (match) {
      scenarios.push({
        title: match[1].trim(),
        line: index + 1,
      });
    }
  }

  return scenarios;
}

async function readFixtureValues(sourceRoot) {
  const values = {};
  await readJsonFixture(join(sourceRoot, "cypress/fixtures/catalog.json"), values);
  await readJsonFixture(join(sourceRoot, "cypress/fixtures/users.json"), values);
  return values;
}

async function readJsonFixture(path, values) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    Object.assign(values, parsed);
  } catch {
    // Evidence remains useful with raw Cypress expressions if fixture data is unavailable.
  }
}

function findTargetScenario(test, featureScenarios) {
  const relatedTitle = test.relatedFeatureScenarios[0]?.title;
  if (relatedTitle != null) {
    const exact = featureScenarios.find((scenario) => scenario.title === relatedTitle);
    if (exact != null) {
      return exact;
    }
  }

  const normalizedTest = slug(test.title);
  return featureScenarios.find((scenario) => {
    const normalizedScenario = slug(scenario.title);
    return normalizedScenario.includes(normalizedTest) || normalizedTest.includes(normalizedScenario);
  }) ?? null;
}

function expectedUrlFor(test, fixtureValues) {
  const urlAssertion = test.assertions.find((assertion) => assertion.subject === "url" || assertion.subject === "location");
  if (urlAssertion == null) {
    return null;
  }
  return resolveFixtureExpression(urlAssertion.expected ?? urlAssertion.expectedExpression, fixtureValues);
}

function visibleOutcomesFor(test, fixtureValues) {
  const outcomes = test.assertions
    .filter((assertion) => String(assertion.assertion ?? "").includes("visible"))
    .map((assertion) => {
      const expected = resolveFixtureExpression(
        assertion.expectedExpression ?? assertion.expected ?? assertion.text,
        fixtureValues,
      );
      const subject = assertion.selector ?? assertion.subject;
      if (expected == null || expected === "") {
        return `${subject} is visible`;
      }
      return `${expected} is visible via ${subject}`;
    });

  return unique(outcomes);
}

function resolveFixtureExpression(value, fixtureValues) {
  if (value == null) {
    return null;
  }

  const raw = String(value);
  if (raw === "featuredProduct.name") {
    return fixtureValues.featuredProduct?.name ?? raw;
  }
  if (raw === "featuredProduct.slug") {
    return fixtureValues.featuredProduct?.slug ?? raw;
  }
  if (raw === "user.roleLabel") {
    return fixtureValues.standardVisitor?.roleLabel ?? raw;
  }

  return raw
    .replace(/\$\{featuredProduct\.name\}/g, fixtureValues.featuredProduct?.name ?? "${featuredProduct.name}")
    .replace(/\$\{featuredProduct\.slug\}/g, fixtureValues.featuredProduct?.slug ?? "${featuredProduct.slug}")
    .replace(/\$\{user\.roleLabel\}/g, fixtureValues.standardVisitor?.roleLabel ?? "${user.roleLabel}");
}

function agreementStatus(cypressStatus, playwrightStatus) {
  if (cypressStatus === "passed" && playwrightStatus === "passed") {
    return "passed";
  }
  if (cypressStatus === "failed" || playwrightStatus === "failed") {
    return "failed";
  }
  return "not-run";
}

function renderEvidenceMarkdown(summary) {
  const lines = [
    "# Synthetic Cypress and Playwright Migration Demo Evidence",
    "",
    `Cypress oracle status: **${summary.statuses.cypressOracle}**`,
    `Playwright migrationdemo status: **${summary.statuses.playwrightMigrationDemo}**`,
    `Agreement status: **${summary.statuses.agreement}**`,
    "",
    "| Cypress test | Playwright/Cucumber scenario | Expected URL | Visible outcomes | Status |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const mapping of summary.mappings) {
    lines.push(
      [
        `\`${mapping.cypress.specPath}\` :: ${mapping.cypress.testTitle}`,
        `${mapping.playwright.featurePath} :: ${mapping.playwright.scenario ?? "_unmatched_"}`,
        mapping.expectedUrl ?? "_none_",
        mapping.visibleOutcomes.join("<br>") || "_none_",
        mapping.status.agreement,
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    );
  }

  lines.push("");
  return `${lines.join("\n")}`;
}
