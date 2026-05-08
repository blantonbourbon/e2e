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

### 7. Generate an Allure Report

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

### 8. Use with IntelliJ + Cucumber+

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
- `test-suite/build/allure-results/`

This avoids browser artifacts from different areas overwriting each other during split task execution, while still allowing Allure to aggregate the test results in one place.

## Extension Guidance

When adding a new app, create the following at the same time:

- `test-suite/src/test/java/com/example/e2e/tests/steps/<app-name>/`
- `test-suite/src/test/java/com/example/e2e/tests/runner/<app-name>/`
- `test-suite/src/test/resources/features/<app-name>/`
- An app-specific `Test` task in `test-suite/build.gradle`

For detailed steps, see [docs/new-app-onboarding.md](/home/kratos/projects/e2e/docs/new-app-onboarding.md).
