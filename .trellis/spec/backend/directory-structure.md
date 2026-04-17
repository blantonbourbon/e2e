# Directory Structure

> How backend code is organized in this project.

---

## Overview

This repository is a Java-based end-to-end automation framework, not a web backend. Its structure should separate:

- reusable framework primitives
- executable test-suite code
- feature specifications and runtime configuration

The current repo already follows the first two layers with `:core` and `:test-suite`. As Cucumber JVM is introduced, keep its files in `:test-suite` so the reusable framework layer stays independent from any single product's scenarios.

---

## Directory Layout

```text
.
├── build.gradle
├── settings.gradle
├── core/
│   ├── build.gradle
│   ├── src/main/java/com/example/e2e/core/
│   │   ├── config/
│   │   ├── reporting/
│   │   └── runtime/
│   └── src/test/java/com/example/e2e/core/
│       ├── config/
│       ├── runtime/
│       └── testsupport/
└── test-suite/
    ├── build.gradle
    ├── src/test/java/
    │   ├── ... smoke tests today
    │   └── ... future cucumber runners, hooks, and step definitions
    └── src/test/resources/
        ├── junit-platform.properties
        └── features/
```

---

## Module Organization

Use these placement rules:

- Root build files:
  - Keep dependency versions, shared Gradle plugins, and cross-module tasks in the root build.
  - Current examples: `build.gradle`, `settings.gradle`

- `core/src/main/java/.../config`:
  - Typed configuration records, enums, config-source adapters, and validation errors live here.
  - Current examples: `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java`, `core/src/main/java/com/example/e2e/core/config/ConfigurationSource.java`, `core/src/main/java/com/example/e2e/core/config/ConfigurationException.java`

- `core/src/main/java/.../runtime`:
  - Playwright lifecycle, browser/context/session management, and shared execution hooks live here.
  - Current examples: `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`, `core/src/main/java/com/example/e2e/core/runtime/PlaywrightSession.java`, `core/src/main/java/com/example/e2e/core/runtime/RuntimeHooks.java`

- `core/src/main/java/.../config` and `.../runtime` together:
  - Authenticated state is configured through typed runtime configuration and applied directly when the Playwright browser context is created.
  - Current examples: `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java`, `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`

- `core/src/main/java/.../reporting`:
  - Reporting abstractions, Allure bridge code, and in-memory test doubles belong here.
  - Current examples: `core/src/main/java/com/example/e2e/core/reporting/ExecutionReporter.java`, `core/src/main/java/com/example/e2e/core/reporting/AllureExecutionReporter.java`, `core/src/main/java/com/example/e2e/core/reporting/InMemoryExecutionReporter.java`

- `core/src/test/java/...`:
  - Unit tests mirror the production package tree.
  - Shared fakes and Playwright doubles belong in `testsupport`.
  - Current examples: `core/src/test/java/com/example/e2e/core/runtime/PlaywrightRuntimeTest.java`, `core/src/test/java/com/example/e2e/core/config/RuntimeConfigurationTest.java`, `core/src/test/java/com/example/e2e/core/testsupport/PlaywrightTestDoubles.java`

- `test-suite/src/test/java/...`:
  - Executable suites live here.
  - Today that is smoke coverage such as `test-suite/src/test/java/TestSuiteSmokeTest.java`.
  - When Cucumber JVM is added, keep these packages here:
    - `.../runner` for the JUnit Platform suite class if one is needed
    - `.../hooks` for `@Before` and `@After` scenario hooks
    - `.../steps` for thin step-definition classes
    - `.../support` for world/state objects, page objects, components, flows, and fixture helpers used only by the executable suite

- `test-suite/src/test/resources/`:
  - Put `junit-platform.properties` here for Cucumber plugin/glue configuration.
  - Put `.feature` files under `features/`, grouped by product area or business capability.

---

## Naming Conventions

Follow these naming rules:

- Java packages stay lowercase and reflect architectural role, not ticket names.
- Production framework classes are nouns with intent-revealing suffixes:
  - `*Configuration`
  - `*Exception`
  - `*Reporter`
  - `*Runtime`
  - `*Hook`
  - `*Handler`
  - `*Supplier`
- Cucumber step-definition classes end in `Steps`.
- Scenario hooks end in `Hooks`.
- Page objects end in `Page`; reusable fragments end in `Component`; higher-level business flows end in `Flow`.
- Feature files use one business capability per file and should stay short enough to be readable in review.
- Keep one `Feature` per `.feature` file, and use `Rule` when a feature contains multiple business rules.

---

## Examples

Current repo examples:

- Module split between shared framework and executable suite:
  - `build.gradle`
  - `core/build.gradle`
  - `test-suite/build.gradle`
- Shared framework package boundaries:
  - `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`
  - `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java`
  - `core/src/main/java/com/example/e2e/core/reporting/ExecutionReporter.java`
- Test mirroring and support doubles:
  - `core/src/test/java/com/example/e2e/core/runtime/PlaywrightRuntimeTest.java`
  - `core/src/test/java/com/example/e2e/core/config/RuntimeConfigurationTest.java`
  - `core/src/test/java/com/example/e2e/core/testsupport/PlaywrightTestDoubles.java`

Target Cucumber JVM layout standard:

- `test-suite/src/test/resources/features/<domain>/<capability>.feature`
- `test-suite/src/test/java/<package>/steps/<Capability>Steps.java`
- `test-suite/src/test/java/<package>/hooks/ScenarioHooks.java`
- `test-suite/src/test/java/<package>/support/pages/<PageName>Page.java`
- `test-suite/src/test/resources/junit-platform.properties`

## External References

- Playwright Java Isolation: https://playwright.dev/java/docs/browser-contexts
- Playwright Java Page Object Models: https://playwright.dev/java/docs/pom
- Cucumber API reference: https://cucumber.io/docs/cucumber/api/
- Gherkin reference: https://cucumber.io/docs/gherkin/reference/
