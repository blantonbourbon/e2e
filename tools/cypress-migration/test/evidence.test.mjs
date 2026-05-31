import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { buildInventory } from "../src/parser.mjs";
import { writeEvidenceSummary } from "../src/evidence.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const syntheticRoot = join(repoRoot, "synthetic-cypress");

describe("Cypress migration evidence summary", () => {
  it("maps synthetic Cypress catalog flows to migrationdemo Cucumber scenarios and outcomes", async () => {
    const inventory = await buildInventory({ sourceRoot: syntheticRoot });
    const outputDir = await mkdtemp(join(tmpdir(), "cypress-evidence-output-"));

    try {
      const evidence = await writeEvidenceSummary(inventory, {
        outputDir,
        repoRoot,
        sourceRoot: syntheticRoot,
        cypressStatus: "passed",
        playwrightStatus: "passed",
      });

      assert.equal(evidence.summary.mappings.length, 2);

      const catalog = evidence.summary.mappings.find(
        (mapping) => mapping.cypress.testTitle === "opens the catalog from the home page",
      );
      assert.equal(catalog.playwright.featurePath, "test-suite/src/test/resources/features/migrationdemo/catalog.feature");
      assert.equal(catalog.playwright.scenario, "Visitor opens the catalog from the home page");
      assert.equal(catalog.expectedUrl, "/catalog.html");
      assert(catalog.visibleOutcomes.some((outcome) => outcome.includes("Product catalog")));
      assert(catalog.visibleOutcomes.some((outcome) => outcome.includes("Backpack")));
      assert.equal(catalog.status.agreement, "passed");

      const product = evidence.summary.mappings.find(
        (mapping) => mapping.cypress.testTitle === "opens product details from the catalog",
      );
      assert.equal(product.playwright.scenario, "Visitor opens product details from the catalog");
      assert.equal(product.expectedUrl, "/product-backpack.html");
      assert(product.visibleOutcomes.some((outcome) => outcome.includes("Backpack")));
      assert(product.visibleOutcomes.some((outcome) => outcome.includes("Add to cart")));
      assert.equal(product.status.cypressOracle, "passed");
      assert.equal(product.status.playwrightMigrationDemo, "passed");

      const markdown = await readFile(evidence.markdownPath, "utf8");
      assert.match(markdown, /Synthetic Cypress and Playwright Migration Demo Evidence/);
      assert.match(markdown, /opens product details from the catalog/);
      assert.match(markdown, /Visitor opens product details from the catalog/);
      assert.match(markdown, /\/product-backpack\.html/);

      const json = JSON.parse(await readFile(evidence.jsonPath, "utf8"));
      assert.equal(json.mappings.length, 2);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
