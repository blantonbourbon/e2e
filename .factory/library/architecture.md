# Architecture

How the E2E framework is organized and how the main pieces interact.

## What belongs here

High-level module boundaries, execution flow, shared invariants, and extension patterns.

## System Overview

The repository is a Gradle multi-module Java 17 project with two product modules:

- `core` — stable reusable automation infrastructure
- `test-suite` — app-specific automation entrypoints, step definitions, and feature resources

The framework is intended to let new application suites plug into `test-suite` while reusing the browser lifecycle, runtime configuration, hooks, and reporting support supplied by `core`.
For this mission, the sample app also needs an app-level opt-in OIDC path built on shared `core` infrastructure, with a pluggable handler contract that can support either saved-session or API/token-bootstrap approaches.

## Module Responsibilities

### `core`

Owns framework code that should remain low-churn:

- Playwright browser, context, and page lifecycle management
- shared runtime configuration loading and validation
- shared auth and OIDC handler contracts
- reusable Cucumber/Playwright hooks support
- common assertions, utilities, and helper abstractions
- reporting support that feeds Allure-compatible results

`core` must not contain app-specific runners, feature files, selectors, or product assertions.

### `test-suite`

Owns executable application-facing automation:

- app-level runner entrypoints
- app-level step definitions
- app-level support code that is specific to a single application area
- feature files under `src/test/resources/features/<app>/...`
- the sample app scaffold that proves the framework runs end to end

`test-suite` depends on `core` for all shared infrastructure rather than re-implementing browser or configuration plumbing locally.

## Execution Flow

1. A user invokes the Gradle wrapper from the repo root.
2. Gradle resolves the multi-module build and routes execution into `test-suite`.
3. `test-suite` selects an app-scoped runner and app-scoped feature resources.
4. Shared runtime configuration supplies values such as the demo app base URL.
5. If the app opts into OIDC mode, shared auth configuration selects an OIDC bootstrap path and handler.
6. `core` initializes Playwright runtime resources, shared hooks, and any authenticated session state needed by the selected mode.
7. Cucumber scenarios execute app-specific step definitions in `test-suite`.
8. Shared reporting plumbing emits Allure-compatible results.
9. Report-generation tasks transform those results into a human-consumable Allure report.

## Worker Implementation Contract

- Use modern JUnit Platform + Cucumber JVM wiring; do not introduce legacy JUnit 4 runner patterns.
- Expose repo-root execution through `./gradlew`.
- Make sample-suite execution and Allure reporting entrypoints discoverable in `./gradlew tasks --all`.
- Keep targeted app execution app-scoped so a worker can run one app's scenarios without pulling unrelated apps into the same run.

## Configuration Contract

- Shared runtime configuration must provide the demo app base URL through `E2E_BASE_URL` or `-De2e.baseUrl=...`.
- Shared runtime configuration must provide auth-mode selection through `E2E_AUTH_MODE` or `-De2e.auth.mode=...`.
- Shared OIDC handler selection must use `E2E_OIDC_HANDLER` or `-De2e.oidc.handler=...`.
- Missing or invalid required base-URL inputs must fail fast with a clear diagnostic naming the bad or missing setting.
- Missing or invalid OIDC settings must fail fast with a clear diagnostic naming the bad or missing auth-layer input.
- App-specific step definitions should consume shared configuration surfaces from `core` instead of hardcoding the demo URL as their only source of truth.
- App-specific step definitions should not implement their own OIDC bootstrap flow outside the shared `core` auth contract.

## Demo Application Path

The sample suite targets a local static demo page served on port `3110`.

- The demo page is a local validation target only.
- The demo page should live in the repository so the framework is self-contained.
- Service startup should be reproducible from repo-local commands and represented in `.factory/services.yaml`.
- Its endpoint must be supplied through shared configuration, not hardcoded solely inside app-specific steps.
- The sample scenario should validate a real interaction with before/after state so the framework proves actual browser automation wiring.
- The sample app must support both a baseline unauthenticated mode and an OIDC-enabled mode selected through shared configuration.
- OIDC validation in this mission must remain repo-local and must not depend on a real external IdP.

## Browser Provisioning

- First-run execution must install or detect Playwright browser binaries automatically as part of the supported setup/run path.
- Browser provisioning is part of the end-to-end framework experience and should not require manual out-of-band setup beyond repo-local commands.

## Authentication Mode Contract

- Baseline mode remains the default path and must continue to run without auth bootstrap.
- OIDC mode is app-opt-in and should establish authenticated startup without human login.
- The shared OIDC contract must be pluggable enough to represent both saved-session reuse and API/token bootstrap strategies.
- For this mission, validation should use repo-local fake or stubbed OIDC behavior rather than a live identity provider.

## Reporting and Observability

- Allure-compatible raw results should be emitted to a stable generated-results location.
- Report generation should produce a stable report output location.
- Invoking report generation before test execution must fail clearly or generate an empty-but-valid report with an explicit prerequisite message.
- Shared lifecycle and hook behavior should leave observable signals in logs or artifacts so validators can confirm the execution path used shared framework plumbing.

## Key Invariants

- Use `./gradlew` as the supported entrypoint; do not assume system Gradle exists.
- Keep ports within `3100-3199`; reserve `3110` for the demo app server.
- `core` stays app-agnostic and reusable.
- App-specific runners and steps stay in `test-suite`.
- Feature files stay under `test-suite/src/test/resources/features/<app>/...`.
- Shared configuration must fail fast when required values such as base URL are invalid or missing.
- Shared auth configuration must make the active mode obvious in logs or artifacts.
- Sample execution must leave actionable result artifacts for both passing and failing runs.

## Extension Pattern

To add another app later:

1. Add a new app-scoped package/folder under `test-suite`.
2. Add that app's runner and step definitions there.
3. Add features under `src/test/resources/features/<new-app>/...`.
4. Reuse `core` configuration, lifecycle, hooks, utilities, and reporting support without changing `core` behavior for existing apps.
5. Consume shared helpers from `core`; do not copy browser/config/reporting helpers into the new app folder.
