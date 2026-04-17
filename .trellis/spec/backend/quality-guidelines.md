# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

Quality in this repo is about reproducibility, isolation, and maintainability of the automation framework. A passing test that is flaky, coupled to internals, or impossible to debug is not good enough.

The main quality bars are:

- each scenario can run independently
- framework code is reusable and typed
- step definitions stay thin
- artifacts make failures diagnosable
- new code matches the existing `:core` and `:test-suite` split

---

## Forbidden Patterns

Do not introduce these patterns:

- Shared mutable static state across scenarios.
  - Cucumber explicitly recommends using dependency-injection modules to share scenario state instead of static variables.
- Reusing a `BrowserContext` or `Page` across independent scenarios.
  - The default expectation is one isolated browser context per scenario or test case.
- Hard sleeps such as `Thread.sleep(...)` in glue or runtime code.
- Inline selectors, navigation logic, or Playwright orchestration directly inside step-definition methods.
- Direct `System.getenv(...)` or `System.getProperty(...)` calls scattered across the codebase when `ConfigurationSource` already owns config resolution.
- Catching an exception, attaching some context, and then letting the scenario continue as if nothing failed.
- Direct database reads or writes from step definitions.
- Secret leakage in Allure steps or attachments.

---

## Required Patterns

These patterns are required:

- Keep reusable infrastructure in `:core` and executable suite code in `:test-suite`.
- Create a fresh browser context for each independent scenario/test.
  - Current anchor: `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`
- Use typed configuration and fail fast on invalid inputs.
  - Current anchors:
    - `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java`
    - `core/src/test/java/com/example/e2e/core/config/RuntimeConfigurationTest.java`
- Centralize reporting through `ExecutionReporter` or a dedicated helper.
  - Current anchors:
    - `core/src/main/java/com/example/e2e/core/reporting/ExecutionReporter.java`
    - `core/src/main/java/com/example/e2e/core/reporting/AllureExecutionReporter.java`
- Use page objects, components, or business flows to capture reusable UI behavior.
- Keep step definitions declarative and thin:
  - map Gherkin text to support-layer calls
  - avoid business logic branches in glue
  - keep assertions in `Then` steps or dedicated assertion helpers
- Configure Cucumber centrally once introduced:
  - use `cucumber-junit-platform-engine` for JUnit 5 execution
  - keep plugin/glue configuration in `src/test/resources/junit-platform.properties`
  - wire Allure through the Cucumber plugin instead of ad hoc per-class setup
- Prefer tags for suite slicing such as smoke, auth mode, browser, or environment assumptions. Keep tag vocabulary small and intentional.

---

## Testing Requirements

Every change should preserve or improve test coverage at the right layer:

- `:core` changes:
  - add or update unit tests under the mirrored package in `core/src/test/java`
  - use `testsupport` doubles instead of real browsers or external systems when possible
  - current examples:
    - `core/src/test/java/com/example/e2e/core/runtime/PlaywrightRuntimeTest.java`
    - `core/src/test/java/com/example/e2e/core/config/RuntimeConfigurationTest.java`

- `:test-suite` changes:
  - maintain at least one smoke-level executable check that proves wiring to `:core`
  - current example: `test-suite/src/test/java/TestSuiteSmokeTest.java`

- Future Cucumber JVM scenarios:
  - put Gherkin features under `src/test/resources/features`
  - keep scenarios independent and taggable
  - attach screenshots or traces for failures that are otherwise hard to debug
  - use JUnit Jupiter or another explicit assertion library in `Then` steps

- Docs/spec changes:
  - update `.trellis/spec/` when a new framework convention is introduced, not weeks later

---

## Code Review Checklist

Reviewers should check:

- Is the file placed in the correct module and package?
- Does the change preserve per-scenario isolation?
- Are step definitions thin, or is browser/business logic leaking into glue?
- Are selectors and reusable UI interactions centralized?
- Are configuration values resolved through the config layer instead of ad hoc environment reads?
- Are failure artifacts useful and free of secrets?
- Are tests added or updated at the correct layer?
- If Cucumber/Allure wiring changed, is it configured centrally rather than duplicated?
- If a new helper or constant was introduced, did the author search for an existing one first?

## Examples

- Good current framework boundaries and abstractions:
  - `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`
  - `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java`
  - `core/src/main/java/com/example/e2e/core/reporting/ExecutionReporter.java`
- Good current unit-test coverage style:
  - `core/src/test/java/com/example/e2e/core/runtime/PlaywrightRuntimeTest.java`
  - `core/src/test/java/com/example/e2e/core/config/RuntimeConfigurationTest.java`
- Good current smoke/integration proof:
  - `test-suite/src/test/java/TestSuiteSmokeTest.java`

## External References

- Playwright Java Isolation: https://playwright.dev/java/docs/browser-contexts
- Playwright Java Page Object Models: https://playwright.dev/java/docs/pom
- Cucumber-JVM installation and JUnit 5 engine note: https://cucumber.io/docs/installation/java/
- Cucumber assertion guidance: https://cucumber.io/docs/cucumber/checking-assertions/
- Cucumber API reference: https://cucumber.io/docs/cucumber/api/
- Allure Cucumber-JVM integration: https://allurereport.org/docs/cucumberjvm/
