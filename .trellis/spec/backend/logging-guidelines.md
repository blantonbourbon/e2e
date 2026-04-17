# Logging Guidelines

> How logging is done in this project.

---

## Overview

This project uses Allure as the primary execution narrative and artifact sink. The current codebase wraps that behavior behind `ExecutionReporter`, with `AllureExecutionReporter` as the default adapter.

For this repo, "logging" means:

- readable execution steps
- high-value diagnostic attachments
- enough context to debug failures without leaking secrets

Do not treat this framework like a long-running server that needs chatty line-by-line logs. Prefer concise lifecycle events and artifacts tied to the scenario or runtime step that produced them.

---

## Log Levels

The current abstraction intentionally stays small:

- `info(...)`
  - Use for notable lifecycle events that help the reader understand what the framework is doing.
  - Current examples:
    - runtime start and navigation in `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`
    - storage-state selection in `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`

- `attachment(...)`
  - Use for structured or semi-structured evidence that is worth preserving in Allure.
  - Current examples:
    - dependency proof in `test-suite/src/test/java/TestSuiteSmokeTest.java`
    - future failure artifacts emitted through `core/src/main/java/com/example/e2e/core/reporting/ExecutionReporter.java`

There is currently no `warn` or `error` level wrapper. Until the abstraction is expanded, use `info(...)` for expected lifecycle narration and let thrown exceptions plus Allure failure status represent errors.

---

## Structured Logging

Apply these rules:

- Prefer one clear sentence per `info(...)` call.
- Include the business-relevant discriminator:
  - whether a storage state file was used
  - storage state path when configured
  - base URL
  - browser/runtime state
- Keep attachment names stable and human-readable, for example:
  - `storage-state.txt`
  - `dependency-proof.txt`
- Text attachments should be easy to skim, using labeled lines or short bullet-like formatting.
- If richer artifact types are needed, add them centrally through the reporting abstraction or a dedicated helper rather than scattering direct `Allure.*` calls across step definitions.

For future Cucumber suites:

- Let Gherkin steps be the primary execution story.
- Use manual Allure steps only for framework-level events or sub-steps that add real debugging value.
- Attach screenshots, trace files, and structured payloads when they materially shorten failure analysis.

---

## What to Log

Log these categories:

- Runtime/session lifecycle:
  - runtime starting
  - browser/session ready
  - navigation target
- Auth/bootstrap decisions:
  - whether a storage state file is being reused
  - which storage state file path was selected
- Diagnostics on failure:
  - screenshot path or content
  - trace artifact location
  - relevant request/response summaries when API setup is involved
- Important suite wiring:
  - dependency smoke checks
  - runner/plugin initialization summaries when Cucumber is introduced

Playwright-specific guidance:

- Prefer screenshot capture on failure or at deliberate checkpoints.
- Record traces for high-value debugging paths rather than all scenarios by default if report size becomes a problem.

---

## What NOT to Log

- API tokens, bearer headers, cookies, or session blobs.
- Full local-storage dumps if they may contain secrets or PII.
- Raw environment-variable values for credentials.
- Repeated low-value noise such as every locator action when the same information is already visible in Playwright traces.
- Duplicate narrative in both Cucumber steps and manual Allure steps unless the manual step adds extra context.

The current code already follows this rule well:

- `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java` logs the storage state file path when one is configured, not cookies or browser-state contents.
- `test-suite/src/test/java/TestSuiteSmokeTest.java` records a small proof attachment instead of dumping framework internals.

## Examples

- Reporting abstraction:
  - `core/src/main/java/com/example/e2e/core/reporting/ExecutionReporter.java`
  - `core/src/main/java/com/example/e2e/core/reporting/AllureExecutionReporter.java`
  - `core/src/main/java/com/example/e2e/core/reporting/InMemoryExecutionReporter.java`
- Lifecycle and navigation narration:
  - `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`
- Existing text attachment usage:
  - `test-suite/src/test/java/TestSuiteSmokeTest.java`

## External References

- Allure Cucumber-JVM integration: https://allurereport.org/docs/cucumberjvm/
- Allure steps: https://allurereport.org/docs/steps/
- Allure attachments: https://allurereport.org/docs/attachments/
- Playwright Java screenshots: https://playwright.dev/java/docs/screenshots
- Playwright Java trace viewer: https://playwright.dev/java/docs/trace-viewer
