# Cypress to Playwright Java Migration

Use this workflow when converting Cypress tests into this repo's Java + Cucumber + Playwright framework.

This workflow deliberately avoids manual Playwright recording as the primary migration path. It uses Cypress source as the migration input and Cypress execution artifacts as the behavior oracle.

## Guardrails

- Do not commit private company Cypress source unless the user explicitly asks for it.
- If the Cypress project is sensitive, inspect it in place or in an ignored scratch directory.
- Keep generated migration evidence under ignored build output unless the user explicitly asks for a committed evidence package.
- Preserve behavioral equivalence, not line-by-line Cypress shape.
- Convert into this repo's framework:
  - features: `test-suite/src/test/resources/features/<area>/`
  - steps: `test-suite/src/test/java/com/example/e2e/tests/steps/<area>/`
  - interaction modules: `test-suite/src/test/java/com/example/e2e/tests/interactions/<area>/`
  - runners: `test-suite/src/test/java/com/example/e2e/tests/runner/<area>/`
- Do not create `Playwright`, `Browser`, or `Page` directly in step definitions; use `PlaywrightManager`.
- Do not translate `cy.wait(number)` to `Thread.sleep(...)`.
- Keep UI login centralized behind role language such as `Given the user is signed in as "standard user"`.
- Manually review mock-heavy, fixture-heavy, hidden custom command setup, `cy.session`, aliases, numeric waits, unsupported commands, write/shared-data flows, and any uncertain draft conversion before promotion.

## Inputs To Request Or Discover

Ask for paths, not pasted proprietary code:

- Cypress project root or read-only copy
- `cypress.config.*`
- `package.json`
- `cypress/e2e/**/*.cy.ts` or `cypress/e2e/**/*.cy.js`
- `cypress/support/**/*`
- `cypress/fixtures/**/*`
- Cypress run artifacts if available: videos, screenshots, JSON/JUnit/Mochawesome reports

If the source cannot be shared, generate a small synthetic Cypress fixture set and use it to validate the migration pattern before touching real tests.

## Executable Path Quick Start

From the repo root, first inspect the implemented command surface:

```bash
node tools/cypress-migration/src/cli.mjs --help
./gradlew :test-suite:tasks --all --console=plain --no-daemon
```

For this repo's checked-in `synthetic-cypress` fixture, use the Gradle tasks:

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

For a private Cypress project, keep source and output explicit:

On WSL, use WSL-local Node.js and Java and prefer Linux-local source/output paths instead of `/mnt/c/...` so the migration tool does not cross the slow Windows filesystem boundary or inherit CRLF issues.

```bash
CYPRESS_SOURCE=/absolute/path/to/cypress-project
MIGRATION_OUT=build/cypress-migration
node tools/cypress-migration/src/cli.mjs inventory --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
node tools/cypress-migration/src/cli.mjs risk --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
node tools/cypress-migration/src/cli.mjs draft --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
```

The synthetic oracle uses a transient loopback static server on `127.0.0.1:8790` and cleans up the exact PID it starts:

```bash
node tools/cypress-migration/src/cli.mjs oracle --source-root synthetic-cypress --output-dir build/cypress-migration --repo-root "$PWD" --port 8790
```

Generated migration evidence remains ignored:

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

## Phase 1: Source Mining Draft

Inventory Cypress specs before writing Java.

Run:

```bash
./gradlew :test-suite:cypressMigrationInventory --console=plain --no-daemon
./gradlew :test-suite:cypressMigrationRisk --console=plain --no-daemon
./gradlew :test-suite:cypressMigrationDraft --console=plain --no-daemon
```

Collect this table:

| Spec | Test title | Area | Business intent | Login/setup | Read/write | Intercepts | Fixtures | Custom commands | Core assertions | Migration target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Mine these signals:

- `describe(...)` and `it(...)` names
- `before(...)` and `beforeEach(...)`
- `cy.visit(...)`
- `cy.get(...)`, `cy.contains(...)`, Testing Library commands, and test IDs
- `.click()`, `.type()`, `.select()`, `.check()`, `.uncheck()`
- `.should(...)`, `expect(...)`, URL/location assertions
- `cy.fixture(...)`
- `cy.intercept(...)` and `cy.wait("@alias")`
- `cy.session(...)`
- `Cypress.Commands.add(...)`

Then produce, but do not blindly apply:

- target feature sketch
- scenario names
- step candidates
- interaction module candidates
- helper/auth/test-data candidates
- risk flags

Read `build/cypress-migration/risk-flags.md` before editing target source. Generated drafts under `build/cypress-migration/draft-features/` are review material, not production tests.

Risk flags:

- mock-heavy
- write-heavy
- shared mutable account/data
- brittle selector
- hidden behavior in custom command
- timing-dependent wait
- needs backend/test-data setup

## Phase 2: Cypress Oracle Baseline

Use Cypress execution as a behavior oracle, not as a script recorder.

For the synthetic fixture, run:

```bash
./gradlew :test-suite:cypressMigrationOracle --console=plain --no-daemon
```

The command writes `build/cypress-migration/oracle-result.json` and `oracle-result.md`. It must not require a persistent service or leave port `8790` bound.

For each migration candidate, capture:

| Cypress spec | Cypress test | Result | Final URL | Visible outcome | Key assertions | Screenshot/video/report | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

If Cypress artifacts are missing, run the narrowest Cypress command available for the candidate. Keep generated Cypress videos/screenshots out of version control unless the user explicitly wants evidence committed.

The oracle should answer:

- What user-visible behavior must still be true?
- Which assertions are business-critical?
- Which assertions are implementation-detail noise?
- What setup is truly required?
- Does the test rely on mocked network behavior?

## Phase 3: Migration Implementation

Migrate one vertical slice at a time.

For a new area:

1. Add `features/<area>/*.feature`.
2. Add `<Area>RunCucumberTest`.
3. Add `steps/<area>`.
4. Add `interactions/<area>` for Playwright details.
5. Register the area in `test-suite/build.gradle` `cucumberAreas`.
6. Keep `parallelEnabled: false` until data/account isolation is proven.

Mapping rules:

- Cypress `it` -> Cucumber `Scenario` or `Scenario Outline`.
- `beforeEach` UI login -> role-based `Background` only if every scenario needs it.
- `cy.fixture` small readonly table -> `Scenario Outline` examples.
- `cy.fixture` large/nested data -> `test-data/<area>` loader/helper.
- `Cypress.Commands.add("login...")` -> auth interaction/helper, not one step per technical action.
- `cy.intercept` -> mark mock-heavy unless the behavior belongs in E2E; use Playwright routing only when intentional.
- Cypress selectors -> stable Playwright locators in interaction modules.

## Phase 4: Verification

Run the narrowest area task first:

```bash
./gradlew :test-suite:test<Area> --console=plain --no-daemon -Dheadless=true
```

For the built-in migration demo and aggregate check:

```bash
./gradlew :test-suite:testMigrationDemo --console=plain --no-daemon -Dheadless=true
./gradlew :test-suite:cypressMigrationEvidence --console=plain --no-daemon -Dheadless=true
./gradlew :test-suite:cypressMigrationCheck --console=plain --no-daemon -Dheadless=true
```

If this repo has no `gradle-wrapper.jar`, use local Gradle or generate the wrapper locally as documented in `README.md`.

On Windows/local-browser mode, remember:

- `playwright.use.local.browser` defaults to true.
- Chromium defaults to local `msedge` when no explicit channel/path is passed.
- Video recording requires Playwright `ffmpeg` in the browser cache.
- If Maven Central is blocked, use an approved repository mirror or temporary Gradle init script rather than editing project repositories.

Create a migration verification table:

| Cypress oracle | Playwright scenario | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |

Mark migrated only when:

- Cucumber scenario preserves the business intent.
- Playwright passes the target area task.
- final URL/visible outcome/key assertions match the Cypress oracle.
- screenshots/traces/Allure are available on failure.
- mock-heavy or write-heavy gaps are explicitly tracked.

## Phase 5: Harden The Migration System

After each slice, update the migration approach:

- Add reusable interaction modules when selectors or assertions repeat.
- Add auth/test-data helpers when setup repeats.
- Update docs or skills when a new Cypress pattern appears.
- Prefer a small extractor script only after repeated source-mining work becomes mechanical.

Executable source-mining output:

- `build/cypress-migration/inventory.json`
- `build/cypress-migration/inventory.md`
- `build/cypress-migration/risk-flags.md`
- `build/cypress-migration/draft-features/`
- `build/cypress-migration/oracle-result.json`
- `build/cypress-migration/oracle-result.md`
- `build/cypress-migration/evidence-summary.json`
- `build/cypress-migration/evidence-summary.md`

Do not let generated drafts become committed test code without review.
