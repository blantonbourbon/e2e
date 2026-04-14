# User Testing

Validation surface findings, tool choices, and concurrency guidance for this mission.

## What belongs here

User-testing surfaces, required tools, setup expectations, and concurrency limits.

## Validation Surface

### CLI / Gradle surface

Primary validation surface for this mission.

- Use Gradle wrapper commands from repo root to validate bootstrap, module wiring, test execution, and reporting.
- Validate app/module structure with filesystem inspection where the contract calls for it.
- Use the local demo app service on port `3110` when executing sample scenarios.
- When OIDC assertions are in scope, run both baseline mode and OIDC-enabled mode explicitly.

### Local demo page surface

This is a support surface for proving the generated framework works end to end.

- The demo page is not the product under test; it exists to validate the framework.
- Prefer CLI-driven validation through the Java test framework rather than manual browsing.
- Use `curl` or equivalent lightweight checks to confirm the demo page is reachable before scenario execution when needed.

## Validation Concurrency

### CLI / browser-backed test execution

- Max concurrent validators: `3`
- Rationale:
  - Machine has 16 logical CPUs.
  - Available memory during planning was roughly 10.3 GiB.
  - Using 70% of memory headroom yields about 7.2 GiB safe budget.
  - A conservative estimate of one browser-backed JVM validator is about 2 GiB including Gradle/JVM/browser overhead.
  - Three concurrent validators fit within the safe budget while leaving room for the demo server and transient build overhead.

### Filesystem-only checks

- Max concurrent validators: `5`
- Rationale:
  - Filesystem inspections are low-cost and do not materially compete for browser or JVM memory.

## Validation Notes

- First-run validation must account for Playwright browser provisioning or cache detection.
- OIDC validation must remain repo-local and must not require a live identity provider.
- Distinguish baseline-mode runs from OIDC-enabled runs in logs or artifacts.
- Distinguish OIDC-bootstrap failures from later scenario assertion failures.
- Distinguish demo-server-unavailable failures from scenario-assertion failures.
- Preserve test and reporting artifacts on failing runs when possible so user-testing synthesis can classify the failure source.
