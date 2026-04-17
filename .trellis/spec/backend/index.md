# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

In this repository, "backend" means the reusable JVM automation framework and execution infrastructure that powers end-to-end tests. It is not an HTTP service. The intended stack is:

- Java 17
- Gradle multi-module build
- Playwright for Java for browser automation
- Cucumber JVM for executable specifications
- Allure for reporting and artifacts

The current codebase already contains the shared framework layer in `:core` and a smoke suite in `:test-suite`. These guidelines document:

- the patterns that already exist in the repo
- the standards new code must follow as the Cucumber layer is added

Read this index first, then open the specific guide for the area you are modifying.

## Current Architecture Anchors

- Build and module split: `build.gradle`, `settings.gradle`, `core/build.gradle`, `test-suite/build.gradle`
- Runtime lifecycle and Playwright session management: `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`
- Typed configuration and fail-fast bootstrap: `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java`
- Reporting abstraction over Allure: `core/src/main/java/com/example/e2e/core/reporting/ExecutionReporter.java`, `core/src/main/java/com/example/e2e/core/reporting/AllureExecutionReporter.java`

## Pre-Development Checklist

- Read [directory-structure.md](./directory-structure.md) before adding packages, modules, step definitions, hooks, or support classes.
- Read [error-handling.md](./error-handling.md) before touching config loading, auth bootstrapping, Playwright lifecycle code, or scenario hooks.
- Read [logging-guidelines.md](./logging-guidelines.md) before adding Allure steps, attachments, screenshots, traces, or framework diagnostics.
- Read [quality-guidelines.md](./quality-guidelines.md) before introducing new test structure, selectors, waits, tags, or cross-module helpers.
- Read [database-guidelines.md](./database-guidelines.md) only if you are proposing direct persistence access or test-data setup via a database.
- Always read [guides/index.md](../guides/index.md) and follow the code-reuse and cross-layer triggers there.

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization, package boundaries, and Cucumber file placement | Active |
| [Database Guidelines](./database-guidelines.md) | Current no-database stance and rules for exceptional data-access cases | Active |
| [Error Handling](./error-handling.md) | Fail-fast exception patterns for config, auth, runtime, and scenario execution | Active |
| [Quality Guidelines](./quality-guidelines.md) | Isolation, reuse, Cucumber step discipline, and review expectations | Active |
| [Logging Guidelines](./logging-guidelines.md) | Allure-based reporting, attachments, and diagnostics hygiene | Active |

## External References

- Playwright Java Isolation: https://playwright.dev/java/docs/browser-contexts
- Playwright Java Page Object Models: https://playwright.dev/java/docs/pom
- Playwright Java Screenshots: https://playwright.dev/java/docs/screenshots
- Playwright Java Trace Viewer: https://playwright.dev/java/docs/trace-viewer
- Cucumber-JVM installation and JUnit 5 integration: https://cucumber.io/docs/installation/java/
- Cucumber API reference for hooks, glue, plugins, and tags: https://cucumber.io/docs/cucumber/api/
- Gherkin reference: https://cucumber.io/docs/gherkin/reference/
- Allure Cucumber-JVM integration: https://allurereport.org/docs/cucumberjvm/
- Allure steps: https://allurereport.org/docs/steps/
- Allure attachments: https://allurereport.org/docs/attachments/

## Rule of Thumb

Keep reusable browser/runtime/auth/reporting infrastructure in `:core`. Keep executable suites, Gherkin features, step definitions, and test-domain helpers in `:test-suite`. When in doubt, prefer a thin glue layer and push reusable behavior into typed support classes.
