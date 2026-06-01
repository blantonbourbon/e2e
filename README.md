# Gradle + Cucumber JVM + Playwright Java E2E Framework

This is a multi-module end-to-end test automation framework built from scratch:

- `core`: encapsulates Playwright browser initialization, shared configuration, scenario context, and Cucumber hooks.
- `test-suite`: contains concrete business test coverage, with `steps` and `features` organized by app.

## Quarterly Progress

- Q1 Playwright progress summary: [summary](docs/reports/q1-playwright-progress.md) / [draw.io diagram](docs/reports/q1-playwright-progress.drawio)

## Project Structure

```text
.
├── build.gradle
├── core
│   └── src/main/java/com/example/e2e/core
│       ├── config
│       ├── context
│       ├── hooks
│       └── playwright
├── settings.gradle
└── test-suite
    ├── src/test/java/com/example/e2e/tests
    │   ├── runner
    │   │   ├── CommonRunCucumberTest.java
    │   │   ├── RunCucumberTest.java
    │   │   └── demoapp
    │   └── steps
    │       ├── common
    │       └── demoapp
    └── src/test/resources/features
        ├── common
        └── demoapp
```

## Module Overview

### `core`

The core module provides:

- `FrameworkConfig`: centrally manages settings such as `base.url`, `browser`, `headless`, and local browser mode via system properties.
- `PlaywrightFactory` / `PlaywrightManager`: manages browser, context, and page lifecycle.
- `ScenarioContext`: supports sharing scenario-scoped data across step definitions.
- `CucumberHooks`: automatically creates sessions before each scenario, captures screenshots on failure, writes traces, and attaches failure artifacts to Allure.

### `test-suite`

The test module provides:

- `CommonRunCucumberTest` and `DemoAppRunCucumberTest`: explicit entry points split by area / app.
- `RunCucumberTest`: the default full-suite entry point used by Gradle `test` and direct JUnit execution.
- `steps/common`: reusable steps shared across applications.
- `steps/demoapp`: step definitions split by business app.
- `features/common` and `features/demoapp`: feature files organized by app.

## Workflow Entry Points

- Record-first new case / new app onboarding: [.codex/skills/record-playwright-cucumber-case/SKILL.md](.codex/skills/record-playwright-cucumber-case/SKILL.md), [.windsurf/workflows/record-new-test-case.md](.windsurf/workflows/record-new-test-case.md), and [docs/new-app-onboarding.md](docs/new-app-onboarding.md).
- Cypress-to-Playwright migration: [.codex/skills/migrate-cypress-to-playwright-java/SKILL.md](.codex/skills/migrate-cypress-to-playwright-java/SKILL.md), [.codex/skills/migrate-cypress-to-playwright-java/REFERENCE.md](.codex/skills/migrate-cypress-to-playwright-java/REFERENCE.md), and [.windsurf/workflows/cypress-to-playwright-java.md](.windsurf/workflows/cypress-to-playwright-java.md).

Keep these workflows separate: record-first onboarding starts from browser actions or a Playwright recording fixture, while Cypress migration starts from Cypress source plus Cypress run evidence.

## How To Run

### 1. Generate the Gradle Wrapper

This repository intentionally does **not** commit `gradle-wrapper.jar` to avoid PR tooling issues with binary files. After cloning for the first time, run:

```bash
gradle wrapper
```

### 2. Playwright Browser Mode

By default:

- Windows automatically enables "local browser mode" and sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
- When `browser=chromium` and no explicit path is provided, the framework defaults to the local `msedge`
- Linux / macOS keep Playwright's default behavior and can continue using downloaded browsers

Common startup command on Windows:

```bash
./gradlew :test-suite:testDemoApp
```

To explicitly use a local browser:

```bash
./gradlew :test-suite:testDemoApp \
  -Dplaywright.use.local.browser=true \
  -Dbrowser=chromium \
  -Dbrowser.channel=chrome
```

Or:

```bash
./gradlew :test-suite:testDemoApp \
  -Dplaywright.use.local.browser=true \
  -Dbrowser.executable.path="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
```

If you want to reuse local browser mode on non-Windows environments as well, explicitly pass `-Dplaywright.use.local.browser=true`.

### 3. Run All E2E Tests

```bash
./gradlew clean test
```

> `test` is the standard Gradle `Test` task and directly runs the full-suite runner: `RunCucumberTest`.

### 4. Pass Runtime Parameters

```bash
./gradlew clean test \
  -Dbase.url=https://playwright.dev \
  -Dbrowser=chromium \
  -Dheadless=true \
  -Dslowmo=0
```

### 5. Run a Specific Area / App Only

```bash
./gradlew :test-suite:testCommon
./gradlew :test-suite:testDemoApp
```

These tasks run their own area-specific runners and generate separate reports and artifact directories.

### 6. Explicitly Run All Areas as an Aggregate

```bash
./gradlew :test-suite:testAllApps
```

### 7. Record-First Onboard a New Case or Area

Use the recorder when you want to operate the browser first, or reuse a Playwright Java recording fixture, and generate a complete Cucumber/Gradle scaffold afterwards. This record-first flow is for new Playwright/Cucumber cases. Cypress-to-Playwright migration is source-based; use the Cypress migration commands in the next section instead of manual recording as the default migration path.

First discover and preflight the command surface:

```bash
./gradlew :test-suite:tasks --all --console=plain --no-daemon
./gradlew :test-suite:onboardCase -Phelp=true --console=plain --no-daemon
node tools/case-recorder/src/onboard.mjs --help
. tools/case-recorder/bin/env.sh
sh tools/case-recorder/bin/doctor.sh
./gradlew :test-suite:caseRecorderCheck --console=plain --no-daemon
```

The doctor must pass before recording. On WSL, it rejects Windows-backed executables such as `/mnt/c/.../npm`; install and use WSL-local Node.js, npm, and Java 21 so recording and generation do not fall back to Windows filesystem access. Keep fixture recordings and the checkout on the Linux filesystem where practical to avoid `/mnt/c` slowness, file-locking differences, and CRLF line endings. The optional `env.sh` helper adds `$HOME/.local/toolchains/node-current/bin` and `$HOME/.sdkman/candidates/java/current/bin` when they exist.

On Windows, run from a Windows-local checkout, not a `\\wsl.localhost\...` path. Windows Gradle can fail while hashing files on WSL UNC/mapped drives. Windows Chromium runs default to local-browser mode and local `msedge` unless you specify a channel/path. From `cmd.exe`, use:

```bat
call tools\case-recorder\bin\env.cmd
gradlew.bat :test-suite:caseRecorderCheck --console=plain --no-daemon
tools\case-recorder\bin\onboard-case.cmd --help
tools\case-recorder\bin\onboard-case.cmd --area adminapp --feature user-profile --scenario "User can open the profile page" --path /profile --base-url https://playwright.dev --task-suffix AdminApp --dry-run
```

Dry-run the complete plan before writing or launching codegen:

```bash
./gradlew :test-suite:onboardCase \
  -Parea=adminapp \
  -Pfeature=user-profile \
  -Pscenario="User can open the profile page" \
  -Ppath=/profile \
  -PtaskSuffix=AdminApp \
  -PdryRun=true \
  --console=plain \
  --no-daemon \
  -Dbase.url=https://playwright.dev
```

Interactive mode launches Playwright codegen for the resolved URL, writes `recording.java` and `metadata.json`, then generates the scaffold after you close the codegen window:

```bash
./gradlew :test-suite:onboardCase \
  -Parea=adminapp \
  -Pfeature=user-profile \
  -Pscenario="User can open the profile page" \
  -Ppath=/profile \
  -PtaskSuffix=AdminApp \
  -Pmode=interactive \
  --console=plain \
  --no-daemon \
  -Dbase.url=https://playwright.dev
```

Fixture mode is unattended and does not launch codegen:

```bash
./gradlew :test-suite:onboardCase \
  -Parea=adminapp \
  -Pfeature=user-profile \
  -Pscenario="User can open the profile page" \
  -Ppath=/profile \
  -PtaskSuffix=AdminApp \
  -Pfixture=/absolute/path/to/recording.java \
  --console=plain \
  --no-daemon \
  -Dbase.url=https://playwright.dev
```

The shell wrapper exposes the same onboarding options:

```bash
tools/case-recorder/bin/onboard-case.sh --help
tools/case-recorder/bin/onboard-case.sh \
  --area adminapp \
  --feature user-profile \
  --scenario "User can open the profile page" \
  --path /profile \
  --base-url https://playwright.dev \
  --task-suffix AdminApp \
  --dry-run
```

For a new area, onboarding creates or updates:

```text
test-suite/src/test/resources/features/<area>/<feature>.feature
test-suite/src/test/java/com/example/e2e/tests/steps/<area>/<FeaturePascal>Steps.java
test-suite/src/test/java/com/example/e2e/tests/runner/<area>/<TaskSuffix>RunCucumberTest.java
test-suite/build.gradle                                  # safe cucumberAreas registration
test-suite/build/case-drafts/<area>/<feature>/recording.java
test-suite/build/case-drafts/<area>/<feature>/metadata.json
test-suite/build/case-drafts/<area>/<feature>/case-draft.json
test-suite/build/case-drafts/<area>/<feature>/draft-summary.md
```

The generated `cucumberAreas` entry includes `taskName`, `taskSuffix`, `runnerClassName`, core/common/area glue, base URL or documented default, `parallelEnabled: false`, `parallelism: 1`, and `explore` defaults. Existing registered areas are reused instead of duplicating runners or Gradle entries.

Safety rules:

- Default execution refuses to overwrite existing source files.
- `-PdryRun=true` / `--dry-run` writes nothing and does not launch codegen.
- `-Pforce=true` / `--force` only refreshes generated-owned feature/step drafts when `metadata.json` ownership evidence matches; it does not force runner or Gradle registration changes.
- Runner-only, Gradle-only, mismatched glue/runner, and feature-without-step states fail before writes with manual-merge guidance.
- Keep `test-suite/build/case-drafts/**`, raw recordings, screenshots/videos, Allure output, and dependency directories out of commits.

Generated feature files are tagged with `@draft` and use common draft interaction steps for simple clicks, fills, navigation, and visibility checks. Review the generated scenario language, selectors, `case-draft.json`, and `draft-summary.md` before promotion. Unsupported recorded actions are emitted as explicit failing step definitions until reviewed and replaced with app-specific behavior; generated drafts are not production-ready tests.

Validation commands:

```bash
./gradlew :test-suite:caseRecorderCheck :test-suite:caseRecorderTest --console=plain --no-daemon
./gradlew :test-suite:caseRecorderOnboardingSmoke --console=plain --no-daemon
./gradlew :test-suite:testAdminApp --console=plain --no-daemon -Dheadless=true
./gradlew :core:compileJava :test-suite:testClasses --console=plain --no-daemon
```

`caseRecorderOnboardingSmoke` is fixture-driven: it creates a disposable workspace, generates a `smokeapp` area from a synthetic recording, verifies `testSmokeApp` discovery and `testAllApps --dry-run`, compiles test classes, runs the generated area headlessly, and removes the workspace.

The legacy split commands remain available for existing registered areas:

```bash
./gradlew :test-suite:recordCase -Parea=demoapp -Pfeature=getting-started -Pscenario="User can open the guide" -Ppath=/ --console=plain --no-daemon
./gradlew :test-suite:generateCaseFromRecording -Parea=demoapp -Pfeature=getting-started --console=plain --no-daemon
./gradlew :test-suite:generateCase -Parea=demoapp -Pfeature=getting-started --console=plain --no-daemon
```

### 8. Migrate Cypress Source With the Executable Oracle

Use this path when converting Cypress tests. It mines Cypress source and validates against Cypress execution evidence; do not paste or commit private Cypress source, Cypress videos/screenshots, or generated migration evidence unless explicitly requested.

Check the command surface:

```bash
node tools/cypress-migration/src/cli.mjs --help
./gradlew :test-suite:tasks --all --console=plain --no-daemon
```

Run the checked-in synthetic source-mining and oracle path:

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

For a private Cypress checkout, keep source and output paths explicit and keep output under ignored build directories:

On WSL, run these with WSL-local Node.js and Java and prefer Linux-local source/output paths instead of `/mnt/c/...` to avoid Windows filesystem and CRLF issues.

```bash
CYPRESS_SOURCE=/absolute/path/to/cypress-project
MIGRATION_OUT=build/cypress-migration
node tools/cypress-migration/src/cli.mjs inventory --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
node tools/cypress-migration/src/cli.mjs risk --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
node tools/cypress-migration/src/cli.mjs draft --source-root "$CYPRESS_SOURCE" --output-dir "$MIGRATION_OUT"
```

Generated migration artifacts are ignored review evidence:

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

Before promoting a migrated slice, review mock-heavy or fixture-heavy specs, hidden custom commands, `cy.session`, aliases, unsupported constructs, write/shared-data flows, and uncertain translations. Numeric Cypress waits must not become `Thread.sleep(...)`, and step definitions must not construct `Playwright`, `Browser`, or `Page` directly; use the framework-managed `PlaywrightManager` through interactions/helpers.

### 9. Generate an Allure Report

```bash
./gradlew :test-suite:allureReport
./gradlew :test-suite:allureServe
```

For area-specific reports, use the aliases generated from `test-suite/build.gradle`:

```bash
./gradlew :test-suite:allureReportDemoApp
./gradlew :test-suite:allureServeDemoApp
```

The hyphenated aliases also work:

```bash
./gradlew :test-suite:allureReport-demoapp
./gradlew :test-suite:allureServe-demoapp
```

### 10. Use with IntelliJ + Cucumber+

If you have the `Cucumber+` plugin installed in IntelliJ IDEA, the recommended workflow is:

1. Import the project with Gradle first, and make sure the `.feature` files under `test-suite/src/test/resources/features/` and the step definitions under `test-suite/src/test/java/com/example/e2e/tests/steps/` are correctly indexed by the IDE.
2. After opening any `.feature` file, you can use the navigation features provided by `Cucumber+`, including jump-to-definition, step definition lookup, and scenario navigation.
3. If you only want to quickly run the current scenario or current feature, use the gutter run icon directly from the `.feature` file.
4. If you want a more stable area-based execution flow, prefer running the corresponding runner class directly in IntelliJ.

```text
test-suite/src/test/java/com/example/e2e/tests/runner/CommonRunCucumberTest.java
test-suite/src/test/java/com/example/e2e/tests/runner/demoapp/DemoAppRunCucumberTest.java
test-suite/src/test/java/com/example/e2e/tests/runner/RunCucumberTest.java
```

5. `CommonRunCucumberTest` is for the shared/common area, `DemoAppRunCucumberTest` is for demoapp, and `RunCucumberTest` runs the full suite.
6. If you need environment parameters, add them as VM options in the IntelliJ Run Configuration. Common example:

```text
-Dbase.url=https://playwright.dev -Dbrowser=chromium -Dheadless=false -Dslowmo=200
```

7. On Windows, if you want to force local browser mode, add this to VM options:

```text
-Dplaywright.use.local.browser=true -Dbrowser=chromium -Dbrowser.channel=chrome
```

Or:

```text
-Dplaywright.use.local.browser=true -Dbrowser.executable.path=C:\Program Files\Google\Chrome\Application\chrome.exe
```

8. If execution is started directly from a `.feature` file, the project uses the default Cucumber configuration from `junit-platform.properties`. If you need stricter execution boundaries, prefer running the corresponding runner class.
9. After a run in IntelliJ, the raw Allure results are still written to `test-suite/build/allure-results/`. To view the complete report, continue in the terminal with:

```bash
./gradlew :test-suite:allureServe
```

## Artifact Output

- `test-suite/build/artifacts/common/`
- `test-suite/build/artifacts/demoapp/`
- `test-suite/build/artifacts/migrationdemo/`
- `test-suite/build/allure-results/`

This avoids browser artifacts from different areas overwriting each other during split task execution, while still allowing Allure to aggregate the test results in one place.

## Extension Guidance

When adding a new app, create the following at the same time:

- `test-suite/src/test/java/com/example/e2e/tests/steps/<area>/`
- `test-suite/src/test/java/com/example/e2e/tests/runner/<area>/`
- `test-suite/src/test/resources/features/<area>/`
- An app-specific `Test` task in `test-suite/build.gradle`

Use a Java-package-safe area name, for example `adminapp` rather than `admin-app`.

For detailed steps, see [docs/new-app-onboarding.md](docs/new-app-onboarding.md).
