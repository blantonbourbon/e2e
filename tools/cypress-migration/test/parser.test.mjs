import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildInventory } from "../src/parser.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const syntheticRoot = join(repoRoot, "synthetic-cypress");

function syntheticSpec(inventory) {
  return inventory.specs.find((spec) => spec.path === "cypress/e2e/catalog.cy.ts");
}

function testByTitle(inventory, title) {
  return syntheticSpec(inventory).tests.find((test) => test.title === title);
}

describe("Cypress source parser", () => {
  it("captures synthetic spec tests, actions, assertions, fixtures, and target candidates", async () => {
    const inventory = await buildInventory({ sourceRoot: syntheticRoot });

    assert.deepEqual(inventory.inputs.specFiles, ["cypress/e2e/catalog.cy.ts"]);
    assert.deepEqual(inventory.inputs.featureFiles, ["cypress/e2e/features/catalog.feature"]);

    const spec = syntheticSpec(inventory);
    assert.equal(spec.suites[0], "Migration demo catalog");
    assert.deepEqual(
      spec.tests.map((test) => test.title),
      ["opens the catalog from the home page", "opens product details from the catalog"],
    );

    const catalogTest = testByTitle(inventory, "opens the catalog from the home page");
    assert.equal(catalogTest.candidateTarget.area, "migrationdemo");
    assert.equal(catalogTest.candidateTarget.feature, "catalog");
    assert.equal(catalogTest.candidateTarget.featurePath, "features/migrationdemo/catalog.feature");
    assert(catalogTest.fixtures.some((fixture) => fixture.name === "users"));
    assert(catalogTest.customCommandUsages.some((usage) => usage.name === "loginAs"));
    assert(
      catalogTest.actions.some(
        (action) => action.command === "click" && action.selector === "[data-testid='catalog-link']",
      ),
    );
    assert(
      catalogTest.assertions.some(
        (assertion) => assertion.subject === "url" && assertion.expected === "/catalog.html",
      ),
    );
    assert(
      catalogTest.assertions.some(
        (assertion) =>
          assertion.command === "should" &&
          assertion.expected === "Product catalog" &&
          assertion.selector === "[data-testid='catalog-heading']",
      ),
    );

    const detailsTest = testByTitle(inventory, "opens product details from the catalog");
    assert(detailsTest.fixtures.some((fixture) => fixture.name === "catalog"));
    assert(
      detailsTest.actions.some((action) => action.selector === "[data-testid='product-${featuredProduct.slug}']"),
    );
    assert(
      detailsTest.assertions.some(
        (assertion) => assertion.subject === "url" && assertion.expected === "/product-${featuredProduct.slug}.html",
      ),
    );
    assert(
      detailsTest.assertions.some(
        (assertion) => assertion.expectedExpression === "featuredProduct.name" && assertion.selector === "[data-testid='product-title']",
      ),
    );
  });

  it("captures hidden loginAs command details and related fixture dependency", async () => {
    const inventory = await buildInventory({ sourceRoot: syntheticRoot });

    const loginAs = inventory.customCommands.find((command) => command.name === "loginAs");
    assert.equal(loginAs.path, "cypress/support/commands.ts");
    assert.deepEqual(loginAs.fixtureDependencies, ["users"]);
    assert(loginAs.stateMutations.some((mutation) => mutation.command === "clearLocalStorage"));
    assert(loginAs.visits.some((visit) => visit.target === "/"));
    assert(
      loginAs.actions.some(
        (action) => action.command === "type" && action.selector === "[data-testid='username']",
      ),
    );
    assert(
      loginAs.actions.some(
        (action) => action.command === "type" && action.selector === "[data-testid='password']",
      ),
    );
    assert(
      loginAs.actions.some(
        (action) => action.command === "click" && action.selector === "[data-testid='sign-in']",
      ),
    );
    assert(
      loginAs.assertions.some(
        (assertion) =>
          assertion.selector === "[data-testid='welcome-message']" &&
          assertion.expectedExpression === "user.roleLabel" &&
          assertion.assertion === "be.visible",
      ),
    );
  });

  it("mines Cypress feature files and reconciles scenarios to target candidates", async () => {
    const inventory = await buildInventory({ sourceRoot: syntheticRoot });

    const feature = inventory.cypressFeatures.find(
      (sourceFeature) => sourceFeature.path === "cypress/e2e/features/catalog.feature",
    );
    assert.equal(feature.name, "Migration demo catalog");
    assert.deepEqual(feature.background.steps, ["Given the visitor signs in as a standard visitor"]);
    assert.deepEqual(
      feature.scenarios.map((scenario) => scenario.title),
      [
        "Visitor opens the catalog from the home page",
        "Visitor opens product details from the catalog",
      ],
    );
    assert.equal(feature.targetCandidate.area, "migrationdemo");
    assert.equal(feature.targetCandidate.feature, "catalog");

    const catalogTest = testByTitle(inventory, "opens the catalog from the home page");
    assert.equal(catalogTest.relatedFeatureScenarios[0].path, "cypress/e2e/features/catalog.feature");
    assert.equal(catalogTest.relatedFeatureScenarios[0].title, "Visitor opens the catalog from the home page");
  });
});
