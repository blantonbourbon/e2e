/// <reference types="cypress" />

type TestUser = {
  username: string;
  password: string;
  roleLabel: string;
};

Cypress.Commands.add("loginAs", (user: TestUser) => {
  cy.clearLocalStorage();
  cy.visit("/");
  cy.get("[data-testid='username']").clear().type(user.username);
  cy.get("[data-testid='password']").clear().type(user.password);
  cy.get("[data-testid='sign-in']").click();
  cy.contains("[data-testid='welcome-message']", user.roleLabel).should("be.visible");
});

declare global {
  namespace Cypress {
    interface Chainable {
      loginAs(user: TestUser): Chainable<void>;
    }
  }
}

export {};
