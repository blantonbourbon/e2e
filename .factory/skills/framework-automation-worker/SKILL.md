---
name: framework-automation-worker
description: Implement reusable core automation code and app-scoped Playwright+Cucumber test-suite features.
---

# Framework Automation Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the work procedure.

## When to Use This Skill

Use for features that create or modify:

- `core` Playwright lifecycle, configuration, hooks, utilities, and reporting helpers
- `test-suite` runners, step definitions, app folders, and feature resources
- the local demo page and sample scenarios that prove the framework end to end

## Required Skills

None.

## Work Procedure

1. Read `mission.md`, `AGENTS.md`, `.factory/services.yaml`, and `.factory/library/architecture.md` before editing.
2. Identify the exact assertions the feature fulfills and translate them into executable checks before implementation.
3. Follow red-green:
   - add or update a failing test/feature/spec first,
   - run it to observe failure,
   - implement the minimum code to make it pass,
   - rerun the focused check before broader validation.
4. Keep boundaries strict:
   - reusable browser/config/hook/reporting code belongs in `core`,
   - app-specific runners and step definitions belong in `test-suite`,
   - feature files belong under `test-suite/src/test/resources/features/<app>/...`.
5. Use `E2E_BASE_URL` or `-De2e.baseUrl=...` as the shared base-URL contract for demo-page execution; do not hardcode the demo endpoint only inside app steps.
6. When OIDC work is in scope, use shared auth configuration such as `E2E_AUTH_MODE` / `-De2e.auth.mode=...` and `E2E_OIDC_HANDLER` / `-De2e.oidc.handler=...`; do not implement auth bootstrap only inside app-local steps.
7. Keep OIDC support framework-only for this mission: implement pluggable handler contracts that can represent saved-session and API/token-bootstrap strategies, but validate them with repo-local fakes/stubs rather than a live IdP.
8. For sample-scenario work, verify the demo page through the supported local service on port `3110`.
9. This worker owns first-run Playwright browser provisioning or cache-detection behavior when a feature fulfills browser-backed execution assertions.
10. When implementing reporting, hooks, or auth bootstrap, leave observable artifacts or logs that prove the shared framework path and active auth mode executed.
11. Run focused module checks first, then the repo validators from `.factory/services.yaml`, plus any contract-specific commands needed by the assertions your feature fulfills.
12. If your feature fulfills cross-area diagnostic assertions, exercise both a demo-unavailable failure and an intentional assertion failure and preserve evidence for both.
13. If your feature fulfills OIDC assertions, exercise both baseline mode and OIDC-enabled mode, plus at least one induced OIDC bootstrap failure with preserved diagnostics.
14. If you execute the sample suite, confirm no orphaned browser or demo-server processes remain after the run.
15. In the handoff, include the exact failing test you started with, the exact passing rerun, and any artifact paths that prove the scenario/report flow worked.

## Example Handoff

```json
{
  "salientSummary": "Implemented shared Playwright lifecycle and base-URL configuration in `core`, then wired the sample-app runner, steps, and features in `test-suite`. Verified the sample scenario against the local demo page and confirmed Allure results were generated from the shared framework path.",
  "whatWasImplemented": "Added reusable `core` runtime/configuration and browser lifecycle plumbing, plus app-scoped sample-app runner, step definitions, feature resources, and demo-page interaction coverage in `test-suite`. The sample suite now consumes shared configuration and reporting helpers instead of duplicating framework logic in app folders.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "./gradlew :core:test --no-daemon --max-workers=2",
        "exitCode": 0,
        "observation": "Core-focused checks passed after the configuration and lifecycle changes."
      },
      {
        "command": "./gradlew :test-suite:test --no-daemon --max-workers=2",
        "exitCode": 0,
        "observation": "Sample-app Cucumber scenarios passed and produced fresh generated results."
      },
      {
        "command": "./gradlew test --no-daemon --max-workers=3",
        "exitCode": 0,
        "observation": "Repo-wide test validation passed after integrating core and test-suite."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Started the demo-app service and ran the sample suite against the configured base URL.",
        "observed": "The scenario asserted a before/after state change on the demo page at http://localhost:3110/ and left Allure-compatible result artifacts."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "test-suite/src/test/resources/features/sample-app/demo.feature",
        "cases": [
          {
            "name": "sample-app interaction updates visible page state",
            "verifies": "The framework can execute a meaningful Playwright+Cucumber scenario against the local demo page."
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- A required contract assertion cannot be satisfied without changing mission boundaries or adding unplanned infrastructure.
- The separation between `core` and `test-suite` becomes ambiguous enough that artifact-level guidance needs updating.
- Playwright browser installation or demo-page execution is blocked by environment issues you cannot resolve locally.
