---
name: framework-bootstrap-worker
description: Build and validate the Gradle/bootstrap/reporting scaffolding for the Java E2E framework.
---

# Framework Bootstrap Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the work procedure.

## When to Use This Skill

Use for features that create or modify:

- Gradle wrapper and root/module build scaffolding
- dependency and plugin wiring
- report task wiring
- demo-app service/bootstrap infrastructure
- repo-level execution entrypoints needed before framework tests can run

## Required Skills

None.

## Work Procedure

1. Read `mission.md`, `AGENTS.md`, `.factory/services.yaml`, and `.factory/library/architecture.md` before editing.
2. Confirm which validation-contract assertions the feature fulfills and design the smallest set of build/bootstrap changes that make those assertions testable.
3. Prefer red-green where feasible:
   - first add or expose a failing verification path (for example a Gradle task, wrapper invocation, or missing report task check),
   - then implement build configuration changes to make that path pass.
4. Keep bootstrap changes repo-root focused:
   - wrapper, settings, root build logic, module build logic, shared version management, and report plugins belong here;
   - app-specific feature files and product assertions do not.
5. If the feature touches the demo server path, make the service runnable through `.factory/services.yaml` conventions and verify reachability on port `3110`.
6. For contract assertions not covered by `.factory/services.yaml`, run the needed contract-specific commands explicitly and record them.
7. If your feature touches reporting, explicitly exercise the pre-test `./gradlew allureReport --no-daemon` path and record whether it gives an empty-valid result or a clear prerequisite message.
8. When a feature is responsible for Allure behavior, use actual Allure Gradle/plugin integration and genuine Allure result artifacts; do not satisfy the contract with handwritten placeholder HTML or synthetic text files.
9. If a smoke test or sample check is cited as evidence for module wiring, make it touch the dependency it claims to verify so the check would fail if the boundary regressed.
10. After edits, run the narrowest relevant commands first, then the repo-level validators from `.factory/services.yaml`.
11. Before handing off, verify there are no orphaned processes from any demo server or report-serving command you started.
12. Record exact commands, exit codes, and observations. If a command is expected to fail as part of red-green, note that explicitly.

## Example Handoff

```json
{
  "salientSummary": "Added the Gradle wrapper, multi-module settings for `core` and `test-suite`, and Allure task wiring. Verified wrapper-first execution from repo root and confirmed the demo server contract for port 3110 is represented in the mission artifacts.",
  "whatWasImplemented": "Created root Gradle bootstrap files, module registration, shared Java 17 configuration, and Allure plugin wiring. Exposed discoverable execution/report tasks through Gradle and aligned the repo with the wrapper-only entrypoint expected by the mission.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "./gradlew projects --no-daemon",
        "exitCode": 0,
        "observation": "Output listed :core and :test-suite from the repo root wrapper."
      },
      {
        "command": "./gradlew tasks --all --no-daemon",
        "exitCode": 0,
        "observation": "Task output exposed the sample test and Allure report entrypoints."
      },
      {
        "command": "./gradlew check --no-daemon --max-workers=3",
        "exitCode": 0,
        "observation": "Root verification completed successfully across the configured modules."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Started the demo-app service command from .factory/services.yaml and fetched http://localhost:3110/",
        "observed": "The local demo page responded on port 3110 and the process was stopped cleanly afterward."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "build.gradle",
        "cases": [
          {
            "name": "allure report tasks are exposed from the wrapper build",
            "verifies": "Bootstrap/reporting entrypoints are discoverable from repo-local Gradle commands."
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The wrapper cannot bootstrap because upstream dependency downloads are unavailable.
- The planned build/reporting approach conflicts with a validation-contract assertion.
- A required command in `.factory/services.yaml` is wrong in a way that blocks the feature and needs orchestrator-level artifact updates.
