/// <reference types="cypress" />

describe("Migration demo catalog", () => {
  beforeEach(() => {
    cy.fixture("users").then(({ standardVisitor }) => {
      cy.loginAs(standardVisitor);
    });
  });

  it("opens the catalog from the home page", () => {
    cy.get("[data-testid='catalog-link']").click();

    cy.url().should("include", "/catalog.html");
    cy.contains("[data-testid='catalog-heading']", "Product catalog").should("be.visible");
    cy.contains("[data-testid='product-card']", "Backpack").should("be.visible");
  });

  it("opens product details from the catalog", () => {
    cy.fixture("catalog").then(({ featuredProduct }) => {
      cy.get("[data-testid='catalog-link']").click();
      cy.get(`[data-testid='product-${featuredProduct.slug}']`).click();

      cy.url().should("include", `/product-${featuredProduct.slug}.html`);
      cy.contains("[data-testid='product-title']", featuredProduct.name).should("be.visible");
      cy.contains("button", "Add to cart").should("be.visible");
    });
  });
});
