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

- Cypress migration is a **source-mining + oracle** workflow. Use Cypress source (`cypress.config.*`, `.cy.js`/`.cy.ts`, Cypress `.feature` files, `support`, and `fixtures`) plus Cypress run evidence as the oracle.
- Do **not** use manual Playwright recording as the default Cypress migration path. The recorder is for record-first onboarding of new Playwright/Cucumber cases.
- Preserve **behavioral equivalence**, not line-by-line Cypress structure.
- Reorganize by business scenario, not by `describe`/`it` nesting.
- Prioritize read-only smoke/regression flows before write-heavy flows.
- Keep UI login first when that is what Cypress uses, but centralize it behind a role-based login module.
- Treat mock-heavy `cy.intercept` specs separately; only migrate them when they carry real E2E value.
- Do not copy `cy.wait(...)` sleeps. Numeric waits must not become `Thread.sleep(...)`; wait on locators, URLs, responses, or business state.
- Do not create `Playwright`, `Browser`, or `Page` directly in step definitions; route browser access through `PlaywrightManager` and interaction/helper modules.
- Do not expose tokens, cookies, local storage, or low-level session mechanics in Gherkin.
- Keep private Cypress source and generated evidence out of commits unless the user explicitly asks for those files to be committed.

## Executable source-mining path

Start from the implemented tool before writing Java. From the repo root, inspect help:

```bash
node tools/cypress-migration/src/cli.mjs --help
```

Use the Gradle tasks for the checked-in synthetic oracle fixture:

```bash
./gradlew :test-suite:cypressMigrationToolTest --console=plain --no-daemon
./gradlew :test-suite:cypressMigrationInventory --console=plain --no-daemon
./gradlew :test-suite:cypressMigrationRisk --console=plain --no-daemon
./gradlew :test-suite:cypressMigrationDraft --console=plain --no-daemon
./gradlew :test-suite:cypressMigrationOracle --console=plain --no-daemon
./gradlew :test-suite:testMigrationDemo --console=plain --no-daemon -Dheadless=true
./gradlew :test-suite:cypressMigrationEvidence --console=plain --no-daemon -Dheadless=true
./gradlew :test-suite:cypressMigrationCheck --console=plain --no-daemon -Dheadless=true
```

Use the CLI directly for a private or copied Cypress project while keeping input/output paths explicit:

On WSL, run with WSL-local Node.js and Java and prefer Linux-local source/output paths over `/mnt/c/...` to avoid slow Windows filesystem access and CRLF surprises.

```bash
CYPRESS_SOURCE=/absolute/path/to/cypress-project
MIGRATION_OUT=build/cypress-migration
node tools/cypress-migration/src/cli.mjs inventory --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
node tools/cypress-migration/src/cli.mjs risk --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
node tools/cypress-migration/src/cli.mjs draft --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
node tools/cypress-migration/src/cli.mjs oracle --source-root synthetic-cypress --output-dir "$MIGRATION_OUT" --repo-root "$PWD" --port 8790
node tools/cypress-migration/src/cli.mjs evidence --source-root synthetic-cypress --output-dir "$MIGRATION_OUT" --repo-root "$PWD" --cypress-status passed --playwright-status passed
```

Generated evidence stays under ignored build output:

```text
build/cypress-migration/inventory.json
build/cypress-migration/inventory.md
build/cypress-migration/risk-flags.md
build/cypress-migration/draft-features/*.feature
build/cypress-migration/oracle-result.json
build/cypress-migration/oracle-result.md
build/cypress-migration/evidence-summary.json
build/cypress-migration/evidence-summary.md
```

Treat everything in `build/cypress-migration/**` as review evidence, not committed production test source.

## Workflow

1. Inventory Cypress coverage.
   - Run `cypressMigrationInventory`, then read `build/cypress-migration/inventory.json` and `inventory.md`.
   - Capture spec path, `it` name, business intent, area, read/write risk, login need, `cy.intercept` usage, fixtures, custom commands, Cypress `.feature` inputs, and core assertions.
   - If the user cannot share source, synthesize representative Cypress examples and use them to validate the migration shape.

2. Review risks before converting.
   - Run `cypressMigrationRisk`, then read `build/cypress-migration/risk-flags.md`.
   - Manual review is required for mock-heavy, fixture-heavy, hidden custom command setup, `cy.session`, aliases, numeric waits, write/shared-data tests, unsupported constructs, and uncertain translations.

3. Run environment preflight.
   - Confirm Java and Gradle are available; if wrapper jar is intentionally absent, use local Gradle or a temporary Gradle distribution.
   - Confirm dependency repositories are reachable; if Maven Central is blocked, use a temporary mirror/init script rather than editing project repositories.
   - Confirm Playwright runtime artifacts required by the framework exist. If video recording is enabled, `ffmpeg` must be installed even when using a local browser.

4. Capture the Cypress oracle.
   - For the synthetic fixture, run `./gradlew :test-suite:cypressMigrationOracle --console=plain --no-daemon`.
   - The oracle starts only a transient loopback server on `127.0.0.1:8790`, captures evidence under `build/cypress-migration/`, and cleans up the PID it started.
   - For private projects, keep Cypress videos/screenshots/reports in ignored evidence locations unless the user explicitly requests a committed evidence package.

5. Choose the first slice.
   - Start with 2-3 high-value read-only flows.
   - Convert each `it` into one Cucumber `Scenario` or a small scenario set.
   - Use `Background` for role login only when every scenario in the feature needs it.

6. Build target modules.
   - Step definitions orchestrate Cucumber phrases only.
   - App interaction modules own locators, Playwright operations, and assertion policy.
   - Test data helpers own fixture loading and generated unique names.
   - Auth helpers expose `Given the user is signed in as {string}` while hiding UI/API/session details.

7. Convert behavior.
   - Translate Cypress commands using [REFERENCE.md](REFERENCE.md).
   - Drop duplicate implementation-detail assertions.
   - Keep critical business assertions and visible user outcomes.
   - Replace brittle selectors with role, label, text, or stable test-id locators where possible.
   - Convert small read-only fixture rows into `Scenario Outline` examples when that makes the behavior clearer.

8. Verify migration.
   - Run the narrow migrated area first, for example `./gradlew :test-suite:testMigrationDemo --console=plain --no-daemon -Dheadless=true`.
   - Run the aggregate Cypress migration check: `./gradlew :test-suite:cypressMigrationCheck --console=plain --no-daemon -Dheadless=true`.
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

- Inventory table based on `build/cypress-migration/inventory.json`
- Target feature file sketch
- Step definition list
- Interaction/helper module list
- Cypress-to-Playwright mapping notes
- Validation commands that were run
- Risks and unresolved decisions from `build/cypress-migration/risk-flags.md`
- Oracle/evidence links under `build/cypress-migration/oracle-result.*` and `evidence-summary.*`

## Review checklist

- [ ] Scenario names state business behavior.
- [ ] Feature files avoid implementation details.
- [ ] Steps do not create `Playwright`, `Browser`, or `Page` directly; they use `PlaywrightManager` through interactions/helpers.
- [ ] Reusable behavior is not duplicated across step classes.
- [ ] UI login is centralized.
- [ ] Mock-heavy, fixture-heavy, unsupported, and uncertain conversions are flagged for manual review.
- [ ] Numeric `cy.wait` has not become `Thread.sleep`.
- [ ] Generated drafts and evidence under `build/cypress-migration/**` are not treated as production-ready tests.
- [ ] Synthetic oracle, narrow Playwright/Cucumber area, and aggregate migration checks pass or failure is explained.
