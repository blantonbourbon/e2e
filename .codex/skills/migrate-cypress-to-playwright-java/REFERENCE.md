# Cypress to Playwright Java/Cucumber Reference

## Shape conversion

| Cypress source | Target shape |
| --- | --- |
| `describe("Checkout", ...)` | `features/<area>/checkout.feature` |
| `it("shows order summary", ...)` | `Scenario: Shopper sees order summary` |
| `beforeEach(login)` | `Background` or auth helper called by steps |
| `Cypress.Commands.add("login", ...)` | Java auth/interaction module, not a step by default |
| `cy.fixture("user.json")` | `src/test/resources/test-data/<area>/user.json` plus loader/helper |
| `support/e2e.ts` setup | Cucumber hooks or Java helper module |

Small read-only fixtures can also become `Scenario Outline` examples when the fixture is just parameter data.

## Command mapping

| Cypress | Playwright Java direction |
| --- | --- |
| `cy.visit("/path")` | `PlaywrightManager.page().navigate("/path")` |
| `cy.get("[data-testid=x]")` | `page.getByTestId("x")` when test id is configured, otherwise `locator(...)` |
| `cy.contains("Save")` | `page.getByText("Save")` or `getByRole(...).filter(...)` |
| `cy.findByRole(...)` | `page.getByRole(...)` |
| `.click()` | `locator.click()` |
| `.type("abc")` | `locator.fill("abc")` for fields, `pressSequentially` only when key events matter |
| `.clear()` | `locator.clear()` |
| `.select(...)` | `locator.selectOption(...)` |
| `.check()` / `.uncheck()` | `locator.check()` / `locator.uncheck()` |
| `.should("be.visible")` | `assertTrue(locator.isVisible(), "...")` or Playwright assertion helper if added |
| `.should("contain", text)` | `assertTrue(locator.textContent().contains(text), "...")` |
| `.should("have.value", value)` | `assertEquals(value, locator.inputValue(), "...")` |
| `cy.url().should(...)` | `page.url()` plus JUnit assertion |
| `cy.location(...)` | `new URI(page.url())` plus JUnit assertion |
| `cy.wait("@alias")` | `page.waitForResponse(...)` only when network outcome is the behavior |
| `cy.wait(1000)` | Do not translate; wait on locator/state/business outcome |
| `cy.intercept(...)` | `page.route(...)`, `browserContext.route(...)`, or prefer real backend for E2E |
| `cy.session(...)` | Central auth module; start with UI login, later swap to storage/API if needed |
| `cy.request(...)` | Java HTTP helper only for setup/teardown; keep feature phrasing business-level |
| `cy.uploadFile(...)` plugins | `locator.setInputFiles(...)` |
| `cy.screenshot(...)` | Usually rely on Cucumber hooks; add explicit screenshot only for intentional evidence |

## Example conversion

Cypress:

```ts
describe("Catalog", () => {
  beforeEach(() => {
    cy.loginAs("standard user");
  });

  it("opens the product details page", () => {
    cy.visit("/catalog");
    cy.contains("Backpack").click();
    cy.url().should("include", "/products/");
    cy.contains("Add to cart").should("be.visible");
  });
});
```

Feature:

```gherkin
Feature: Catalog browsing

  Background:
    Given the user is signed in as "standard user"

  Scenario: Shopper opens product details
    When the user opens the catalog
    And the user opens the "Backpack" product
    Then the product details page should be shown
    And the add to cart action should be available
```

Step definitions should delegate:

```java
public class CatalogSteps {
    private final CatalogInteractions catalog = new CatalogInteractions();

    @When("the user opens the catalog")
    public void openCatalog() {
        catalog.open();
    }

    @When("the user opens the {string} product")
    public void openProduct(String productName) {
        catalog.openProduct(productName);
    }
}
```

Interaction module owns Playwright details:

```java
public class CatalogInteractions {
    public void open() {
        PlaywrightManager.page().navigate("/catalog");
    }

    public void openProduct(String productName) {
        PlaywrightManager.page().getByText(productName).click();
    }
}
```

## Inventory template

| Spec | Test | Area | Intent | Read/write | Login | Intercepts | Fixtures | Core assertions | Target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cypress/e2e/catalog.cy.ts` | opens product details | catalog | product details accessible | read | standard user | no | no | URL, Add to cart visible | `catalog.feature` |

## Decision rules

- If a Cypress assertion proves user-visible behavior, migrate it.
- If it only proves implementation details, drop it or replace it with a user-visible assertion.
- If a spec has many intercepts, label it mock-heavy and decide whether it belongs in E2E.
- If a fixture contains a short set of read-only inputs, prefer a `Scenario Outline` over a Java fixture loader.
- If a fixture is large, shared, or nested, keep it under `src/test/resources/test-data/<area>/` and add a loader/helper.
- If a selector is unstable, fix the selector strategy during migration rather than preserving the brittle selector.
- If a test mutates shared data, design data isolation before migration.
- If a custom command hides business behavior, turn it into an interaction module.
- If a custom command hides technical setup, turn it into a support/helper module.

## Verification gotchas

- Missing `gradle-wrapper.jar` means `gradlew` will fail until the wrapper is generated or a local/temporary Gradle is used.
- Missing Java means no Gradle task can start; set `JAVA_HOME` for the validation command.
- Maven Central may be blocked in some networks; use a temporary Gradle init script with an approved mirror for validation.
- When this framework records video, Playwright Java needs `ffmpeg` under the Playwright browser cache even if Chromium runs through a local browser channel.
