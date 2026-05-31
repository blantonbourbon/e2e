import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { buildInventory } from "../src/parser.mjs";

async function writeRiskFixture() {
  const sourceRoot = await mkdtemp(join(tmpdir(), "cypress-risk-fixture-"));
  await mkdir(join(sourceRoot, "cypress/e2e"), { recursive: true });
  await mkdir(join(sourceRoot, "cypress/fixtures"), { recursive: true });
  await writeFile(
    join(sourceRoot, "cypress.config.ts"),
    `export default { e2e: { baseUrl: "http://localhost:8790" } };\n`,
  );
  await writeFile(join(sourceRoot, "cypress/fixtures/cart.json"), `{"items":[{"name":"Backpack"}]}\n`);
  await writeFile(
    join(sourceRoot, "cypress/e2e/checkout.cy.ts"),
    `
describe("Checkout risk", () => {
  it("uses mocked checkout session", () => {
    cy.session("shopper", () => {
      cy.visit("/login");
    });
    cy.intercept("GET", "/api/cart", { fixture: "cart" }).as("cart");
    cy.wait("@cart");
    cy.wait(500);
    cy.get(".checkout").click();
    cy.request("POST", "/api/orders", {});
  });
});
`,
  );
  return sourceRoot;
}

describe("Cypress risk classification", () => {
  it("keeps unsupported and unsafe Cypress constructs actionable with source context", async () => {
    const sourceRoot = await writeRiskFixture();

    try {
      const inventory = await buildInventory({ sourceRoot });
      const test = inventory.specs[0].tests[0];
      const riskTypes = new Set(test.risks.map((risk) => risk.type));

      assert(riskTypes.has("session"));
      assert(riskTypes.has("mock-heavy"));
      assert(riskTypes.has("alias"));
      assert(riskTypes.has("timing-dependent"));
      assert(riskTypes.has("write/shared-data"));
      assert(riskTypes.has("brittle-selector"));

      for (const risk of test.risks) {
        assert.equal(risk.context.specPath, "cypress/e2e/checkout.cy.ts");
        assert.equal(risk.context.testTitle, "uses mocked checkout session");
        assert.match(risk.suggestion, /Review|Replace|Design|Prefer/);
      }

      assert(
        test.unsupportedConstructs.some(
          (unsupported) => unsupported.command === "cy.intercept" && unsupported.suggestion.includes("mock"),
        ),
      );
      assert(
        test.unsupportedConstructs.some(
          (unsupported) => unsupported.command === "cy.wait" && unsupported.suggestion.includes("locator"),
        ),
      );
    } finally {
      await rm(sourceRoot, { recursive: true, force: true });
    }
  });
});
