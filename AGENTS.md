# AGENTS.md

This file gives repository-specific guidance for contributors and coding agents working in this repo.

## Repo Summary

- Project name: `e2e-framework`
- Stack: Java 21, Gradle, Playwright Java, Cucumber JVM, JUnit Platform
- Shape: multi-module test automation repo
- Modules:
  - `core`: reusable framework code
  - `test-suite`: executable test scenarios, step definitions, and feature files

## Module Boundaries

Keep changes in the correct module. This matters more here than in a typical single-module test repo.

- Put reusable framework behavior in `core`
  - browser/session lifecycle
  - configuration and system property handling
  - scenario-scoped shared state
  - Cucumber hooks
- Put business-facing test behavior in `test-suite`
  - step definitions
  - feature files
  - app-specific selectors and assertions
  - runner configuration tied to test execution

If a change is only useful for one application or one feature area, it usually belongs in `test-suite`, not `core`.

## Current Layout

- `build.gradle`: shared Gradle configuration for all subprojects
- `settings.gradle`: includes `core` and `test-suite`
- `core/src/main/java/com/example/e2e/core`
  - `config/FrameworkConfig.java`
  - `context/ScenarioContext.java`
  - `hooks/CucumberHooks.java`
  - `playwright/*`
- `test-suite/src/test/java/com/example/e2e/tests`
  - `runner/CommonRunCucumberTest.java`
  - `runner/RunCucumberTest.java`
  - `runner/demoapp/DemoAppRunCucumberTest.java`
  - `steps/common/*`
  - `steps/demoapp/*`
- `test-suite/src/test/resources/features`
  - `common/*`
  - `demoapp/*`

## Working Conventions

### Playwright usage

- Do not create Playwright, Browser, or Page objects directly inside step definitions.
- Use `PlaywrightManager` as the entry point for test code.
- Reuse the session that `CucumberHooks` creates per scenario.
- Prefer relative navigation such as `"/"` and let `base.url` control the environment.
- Windows defaults to local-browser mode. The framework skips Playwright browser download there and defaults `browser=chromium` to the local `msedge` channel unless overridden.

### Shared scenario state

- Use `PlaywrightManager.scenarioContext()` for data that must move across steps in the same scenario.
- Do not use static mutable state for cross-step data.
- `ScenarioContext` is cleared automatically during teardown.

### Feature and step organization

- Keep feature files grouped by app or domain under `test-suite/src/test/resources/features/<app-name>/`.
- Keep step definitions grouped the same way under `test-suite/src/test/java/com/example/e2e/tests/steps/<app-name>/`.
- Keep `features/common` as an explicit shared area with its own runner and Gradle task.
- Put cross-app reusable steps in `steps/common` and shared feature coverage in `features/common`.
- When adding a new app, create both directories at the same time so boundaries stay aligned.
- When adding a new app, also add an app-specific runner and `Test` task in `test-suite/build.gradle`.

### Assertions and selectors

- Keep assertions explicit and readable. The current codebase uses JUnit Jupiter assertions.
- Prefer stable Playwright locators over brittle selectors.
- Avoid `Thread.sleep(...)`; rely on Playwright waiting behavior unless there is a strong reason not to.

### Configuration

Central runtime settings are loaded from system properties in `FrameworkConfig`.

Current supported properties:

- `base.url`
- `browser` with supported values `chromium`, `firefox`, `webkit`
- `browser.channel`
- `browser.executable.path`
- `headless`
- `slowmo`
- `playwright.use.local.browser`
- `artifacts.dir`

If you add a new runtime toggle, wire it through `FrameworkConfig` instead of reading ad hoc system properties from multiple places.

## Artifacts and Reports

- Default artifact root is `build/artifacts`
- Area-specific tasks override the root to `test-suite/build/artifacts/<area>`
- Trace files are written under `test-suite/build/artifacts/<area>/traces`
- Video directories are created under `test-suite/build/artifacts/<area>/videos`
- `FrameworkConfig` also defines `test-suite/build/artifacts/<area>/screenshots`; failure screenshots are attached in hooks and also published to Allure on failure
- Allure raw results are written under `test-suite/build/allure-results`
- Cucumber native HTML/JSON report output is no longer the primary reporting path

Keep generated artifacts out of version control unless the user explicitly asks otherwise.

## Commands

### Bootstrap

The repo intentionally does not commit `gradle-wrapper.jar`.

After cloning, generate the wrapper locally if needed:

```bash
gradle wrapper
```

### Run all tests

```bash
./gradlew clean test
```

`test` is a standard Gradle `Test` task that executes `com.example.e2e.tests.runner.RunCucumberTest`.

### Run one feature area

```bash
./gradlew :test-suite:testCommon
./gradlew :test-suite:testDemoApp
```

### Run all areas explicitly

```bash
./gradlew :test-suite:testAllApps
```

### Generate Allure report

```bash
./gradlew :test-suite:allureReport
./gradlew :test-suite:allureServe
```

### Override runtime settings

```bash
./gradlew clean test \
  -Dbase.url=https://playwright.dev \
  -Dbrowser=chromium \
  -Dheadless=true \
  -Dslowmo=0
```

## Change Guidance

When making edits, preserve the current architecture:

- Keep `core` generic. Avoid leaking app-specific selectors, URLs, or business terms into it.
- Keep `test-suite` focused on user-observable behavior.
- Preserve package naming under `com.example.e2e`.
- Prefer small, targeted additions over framework-wide abstractions unless multiple scenarios already need the same behavior.
- Keep dynamic plugin/artifact/parallel configuration in `test-suite/build.gradle`.
- Keep runners scope-only; use `junit-platform.properties` for broad defaults and let Gradle tasks override glue and runtime wiring per area.

Good examples:

- Adding a new reusable navigation helper in `core` when multiple test areas need it
- Adding a new `demoapp` step definition in `test-suite` for one page flow
- Adding a new feature folder and matching steps package for a new app

Bad examples:

- Creating raw Playwright sessions inside step classes
- Reading system properties directly in many step files
- Mixing common steps and one-off app steps in the same package without a clear reason

## Validation Expectations

Before finishing a change, validate at the narrowest sensible scope first, then broaden if needed.

- For step or feature changes, run the relevant area-specific task such as `:test-suite:testCommon` or `:test-suite:testDemoApp`.
- For framework changes in `core`, prefer running the full test suite because hooks and session lifecycle affect every scenario.
- If tests are not run, state that clearly and explain why.

## Files To Avoid Changing Casually

- `gradle.properties`: contains repo-level Gradle behavior and a Java home override
- `build.gradle`: shared configuration for every subproject
- `test-suite/build.gradle`: area-specific test orchestration, glue, reports, and runtime property wiring
- `test-suite/src/test/java/com/example/e2e/tests/runner/RunCucumberTest.java`: default full-suite runner used by Gradle `test`

Change these only when the task genuinely requires repo-wide behavior changes.

## Notes For Agents

- Read existing step definitions and features before adding new ones. Match the current naming and package structure.
- Prefer extending current hooks/config/session management instead of introducing parallel lifecycle code.
- Preserve the current model: `test` runs the full-suite runner, each area has its own runner and Gradle `Test` task, and `testAllApps` remains the aggregate entrypoint for area tasks.
- When onboarding a new app area, follow [docs/new-app-onboarding.md](/home/kratos/projects/e2e/docs/new-app-onboarding.md).
- Do not commit generated `build/` output.
- Do not add `gradle-wrapper.jar` unless explicitly requested. This repo currently omits it on purpose.
