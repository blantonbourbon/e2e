# Error Handling

> How errors are handled in this project.

---

## Overview

This framework follows a fail-fast model:

- reject invalid configuration at startup
- reject missing auth material at bootstrap time
- clean up browser resources on failure
- let scenario execution fail loudly instead of hiding defects

Because this repo is an E2E test framework, failures are surfaced by thrown exceptions, JUnit Platform test failures, and Allure artifacts. There is no HTTP error-response contract to maintain inside this repo.

---

## Error Types

Use specific unchecked exceptions with clear ownership:

- `ConfigurationException`
  - Use for invalid or missing runtime configuration.
  - Current example: `core/src/main/java/com/example/e2e/core/config/ConfigurationException.java`

- `IllegalArgumentException`
  - Use for programmer misuse of a public API, such as an unsupported browser name.
  - Current example: `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`

- `IllegalStateException`
  - Use only for invariant breaches that indicate a bug or impossible state after validation should already have happened.
  - The simplified runtime currently avoids a dedicated example here by validating configuration up front and using direct context creation.

---

## Error Handling Patterns

Follow these patterns:

- Validate inputs at boundaries.
  - Constructor arguments are guarded with `Objects.requireNonNull(...)`.
  - Parsed configuration is validated before any browser is started.
  - Current examples:
    - `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`
    - `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java`

- Fail with actionable messages.
  - Mention the exact property or environment variable name.
  - Mention accepted values when the value is constrained.
  - Current examples:
    - `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java`
    - `core/src/test/java/com/example/e2e/core/config/RuntimeConfigurationTest.java`

- Clean up and rethrow.
  - If browser/session startup fails after partial initialization, close what was opened and rethrow the original exception.
  - Do not wrap exceptions unless the new type adds clear domain meaning.
  - Current example: `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`

- Enrich failures with artifacts, not suppression.
  - In Cucumber hooks or support helpers, it is acceptable to capture a screenshot, trace path, or attachment before rethrowing.
  - It is not acceptable to catch and ignore Playwright, assertion, or bootstrap exceptions.

- Keep hook cleanup best-effort and idempotent.
  - Session close paths must tolerate repeated calls and partial startup.
  - Current example: the guarded `closed` flag in `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`

---

## Scenario Failure Surface

This project reports failures through the test framework, not through JSON responses.

- Let exceptions bubble out of step definitions and hooks so the scenario fails in JUnit Platform and Allure.
- Use Allure steps and attachments to explain the failure context.
- Keep assertion logic in `Then` steps or dedicated assertion helpers.
- Do not convert failures to booleans, sentinel strings, or custom status objects.

---

## Common Mistakes

- Catching a Playwright or assertion exception only to log it and continue.
- Throwing bare `RuntimeException` with no config key, handler type, or scenario context.
- Hiding cleanup bugs by swallowing `close()` failures without any traceability.
- Using step-definition conditionals to turn a real failure into "optional behavior."
- Validating configuration late, after browser startup or network calls have already begun.

## Examples

- Fail-fast configuration parsing with explicit property names:
  - `core/src/main/java/com/example/e2e/core/config/RuntimeConfiguration.java`
  - `core/src/test/java/com/example/e2e/core/config/RuntimeConfigurationTest.java`
- Storage-state configuration applied directly during context creation:
  - `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`
  - `core/src/test/java/com/example/e2e/core/runtime/PlaywrightRuntimeTest.java`
- Cleanup and rethrow during runtime startup:
  - `core/src/main/java/com/example/e2e/core/runtime/PlaywrightRuntime.java`

## External References

- Cucumber hooks and scenario execution: https://cucumber.io/docs/cucumber/api/
- Allure steps and exception handling: https://allurereport.org/docs/steps/
