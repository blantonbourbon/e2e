import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { buildInventory } from "../src/parser.mjs";
import { writeMigrationArtifacts } from "../src/renderers.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const syntheticRoot = join(repoRoot, "synthetic-cypress");

describe("Cypress migration renderers", () => {
  it("writes review-first inventory, risk, and draft artifacts under the configured output directory", async () => {
    const inventory = await buildInventory({ sourceRoot: syntheticRoot });
    const outputDir = await mkdtemp(join(tmpdir(), "cypress-migration-render-"));

    try {
      const artifacts = await writeMigrationArtifacts(inventory, { outputDir });
      const artifactPaths = [
        artifacts.inventoryJson,
        artifacts.inventoryMarkdown,
        artifacts.riskMarkdown,
        ...artifacts.draftFeatures.map((draft) => draft.path),
      ];

      for (const artifactPath of artifactPaths) {
        assert(!relative(outputDir, artifactPath).startsWith(".."), `${artifactPath} should stay in output dir`);
      }

      const inventoryJson = JSON.parse(await readFile(artifacts.inventoryJson, "utf8"));
      assert.equal(inventoryJson.specs[0].path, "cypress/e2e/catalog.cy.ts");
      assert.equal(inventoryJson.cypressFeatures[0].path, "cypress/e2e/features/catalog.feature");

      const inventoryMarkdown = await readFile(artifacts.inventoryMarkdown, "utf8");
      assert.match(inventoryMarkdown, /Migration demo catalog/);
      assert.match(inventoryMarkdown, /opens product details from the catalog/);
      assert.match(inventoryMarkdown, /loginAs/);
      assert.match(inventoryMarkdown, /cypress\/e2e\/features\/catalog\.feature/);

      const riskMarkdown = await readFile(artifacts.riskMarkdown, "utf8");
      assert.match(riskMarkdown, /hidden-setup/);
      assert.match(riskMarkdown, /cypress\/e2e\/catalog\.cy\.ts/);
      assert.match(riskMarkdown, /loginAs/);
      assert.match(riskMarkdown, /fixture-data/);
      assert.match(riskMarkdown, /opens product details from the catalog/);

      const draftFeaturePath = join(outputDir, "draft-features", "catalog.feature");
      assert(artifacts.draftFeatures.some((draft) => draft.path === draftFeaturePath));
      const draftFeature = await readFile(draftFeaturePath, "utf8");
      assert.match(draftFeature, /# REVIEW: Generated draft; do not promote without manual migration review\./);
      assert.match(draftFeature, /# REVIEW: Hidden Cypress setup via custom command `loginAs`/);
      assert.match(draftFeature, /# REVIEW: Fixture-backed data requires review: `users`, `catalog`/);
      assert.match(draftFeature, /Background:/);
      assert.match(draftFeature, /Given the visitor signs in as a standard visitor/);
      assert.match(draftFeature, /Scenario: Visitor opens the catalog from the home page/);
      assert.match(draftFeature, /Scenario: Visitor opens product details from the catalog/);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
