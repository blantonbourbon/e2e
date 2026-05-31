---
name: migrate-cypress-to-playwright-java
description: Migrate Cypress test suites into a Java Playwright Cucumber E2E framework while preserving behavior, not Cypress implementation shape. Use when the user mentions Cypress-to-Playwright migration, converting `.cy.js`/`.cy.ts` specs, Cypress commands, `cy.session`, `cy.intercept`, or moving tests into this repo's Java/Cucumber/Gradle framework.
---

# Migrate Cypress to Playwright Java

## Default target

Assume the target is this repo's Java 21 + Gradle + Playwright Java + Cucumber JVM framework unless the user says otherwise.

- Features: `test-suite/src/test/resources/features/<area>/`
- Steps: `test-suite/src/test/java/com/example/e2e/tests/steps/<area>/`
- Shared steps: `steps/common`
- Reusable app behavior: create `test-suite` helper/interaction modules rather than putting raw Playwright details in every step.
- Runtime toggles belong in `FrameworkConfig`, not ad hoc property reads.

## Migration principles

- Preserve **behavioral equivalence**, not line-by-line Cypress structure.
- Reorganize by business scenario, not by `describe`/`it` nesting.
- Prioritize read-only smoke/regression flows before write-heavy flows.
- Keep UI login first when that is what Cypress uses, but centralize it behind a role-based login module.
- Treat mock-heavy `cy.intercept` specs separately; only migrate them when they carry real E2E value.
- Do not copy `cy.wait(...)` sleeps. Use Playwright locators and assertions with auto-waiting.
- Do not expose tokens, cookies, local storage, or low-level session mechanics in Gherkin.

## Workflow

1. Inventory Cypress coverage.
   - Capture spec path, `it` name, business intent, area, read/write risk, login need, `cy.intercept` usage, fixtures, custom commands, and core assertions.
   - If the user cannot share source, synthesize representative Cypress examples and use them to validate the migration shape.

2. Run environment preflight.
   - Confirm Java and Gradle are available; if wrapper jar is intentionally absent, use local Gradle or a temporary Gradle distribution.
   - Confirm dependency repositories are reachable; if Maven Central is blocked, use a temporary mirror/init script rather than editing project repositories.
   - Confirm Playwright runtime artifacts required by the framework exist. If video recording is enabled, `ffmpeg` must be installed even when using a local browser.

3. Choose the first slice.
   - Start with 2-3 high-value read-only flows.
   - Convert each `it` into one Cucumber `Scenario` or a small scenario set.
   - Use `Background` for role login only when every scenario in the feature needs it.

4. Build target modules.
   - Step definitions orchestrate Cucumber phrases only.
   - App interaction modules own locators, Playwright operations, and assertion policy.
   - Test data helpers own fixture loading and generated unique names.
   - Auth helpers expose `Given the user is signed in as {string}` while hiding UI/API/session details.

5. Convert behavior.
   - Translate Cypress commands using [REFERENCE.md](REFERENCE.md).
   - Drop duplicate implementation-detail assertions.
   - Keep critical business assertions and visible user outcomes.
   - Replace brittle selectors with role, label, text, or stable test-id locators where possible.
   - Convert small read-only fixture rows into `Scenario Outline` examples when that makes the behavior clearer.

6. Verify migration.
   - Run the narrow area task first, for example `./gradlew :test-suite:testDemoApp`.
   - For framework changes, run `./gradlew clean test`.
   - Compare Cypress and Playwright results for the same business scenario before marking migrated.
   - Check screenshot, trace, and Allure output on failures.

## Synthetic validation mode

When company Cypress source cannot be shared, create a small local Cypress-style fixture set with:

- `cypress/e2e/**/*.cy.ts`
- `cypress/e2e/features/**/*.feature`
- `cypress/support/commands.ts`
- `cypress/fixtures/*.json`
- a deterministic local/static app or resource-backed page

Then migrate that fixture into a small area task and run the narrow task. Use failures to harden this skill.

## Output format

When planning a migration, produce:

- Inventory table
- Target feature file sketch
- Step definition list
- Interaction/helper module list
- Cypress-to-Playwright mapping notes
- Validation commands
- Risks and unresolved decisions

## Review checklist

- [ ] Scenario names state business behavior.
- [ ] Feature files avoid implementation details.
- [ ] Steps do not create `Playwright`, `Browser`, or `Page` directly.
- [ ] Reusable behavior is not duplicated across step classes.
- [ ] UI login is centralized.
- [ ] Mock-heavy tests are flagged.
- [ ] `cy.wait` has not become `Thread.sleep`.
- [ ] Narrow Gradle task passes or failure is explained.
