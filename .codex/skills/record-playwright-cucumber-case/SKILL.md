---
name: record-playwright-cucumber-case
description: Record or fixture-generate a new Playwright Java/Cucumber case, including complete area scaffolding and Gradle registration. Use when the user wants a record-first workflow for new test cases or a new app area in this repository. Do not use for Cypress source migration.
---

# Record Playwright Cucumber Case

Use this skill for **record-first onboarding of new Playwright/Cucumber cases** in this repo. Cypress-to-Playwright migration is a separate source-mining/oracle workflow; use `.codex/skills/migrate-cypress-to-playwright-java/SKILL.md` and `.windsurf/workflows/cypress-to-playwright-java.md` when Cypress source is the input.

## Entry Points

From the repository root, discover and preflight the command surface first:

```bash
./gradlew :test-suite:tasks --all --console=plain --no-daemon
./gradlew :test-suite:onboardCase -Phelp=true --console=plain --no-daemon
node tools/case-recorder/src/onboard.mjs --help
```

Run the recorder preflight before any onboarding write:

```bash
. tools/case-recorder/bin/env.sh
sh tools/case-recorder/bin/doctor.sh
./gradlew :test-suite:caseRecorderCheck --console=plain --no-daemon
```

On WSL, `doctor.sh` must use WSL-local `node`, `npm`, and Java 21; it rejects Windows-backed executables such as `/mnt/c/.../npm`. Keep the checkout and any fixture recording on the Linux filesystem when possible to avoid `/mnt/c` performance, file locking, and CRLF hazards.

On Windows, run from a Windows-local checkout rather than `\\wsl.localhost\...`, use `gradlew.bat`, and prefer the `.cmd` wrapper:

```bat
call tools\case-recorder\bin\env.cmd
gradlew.bat :test-suite:caseRecorderCheck --console=plain --no-daemon
tools\case-recorder\bin\onboard-case.cmd --help
```

Windows local-browser mode is the framework default for Chromium and resolves to local `msedge` unless a browser channel or executable path is supplied.

## Full Gradle Flow

Dry-run first. Dry-run prints the full plan and does not write source, draft metadata, or launch Playwright codegen:

```bash
./gradlew :test-suite:onboardCase \
  -Parea=adminapp \
  -Pfeature=user-profile \
  -Pscenario="User can open the profile page" \
  -Ppath=/profile \
  -PtaskSuffix=AdminApp \
  -PdryRun=true \
  --console=plain \
  --no-daemon \
  -Dbase.url=https://playwright.dev
```

Interactive recording launches Playwright codegen for the resolved URL, writes raw recorder metadata, and resumes generation after the codegen window is closed:

```bash
./gradlew :test-suite:onboardCase \
  -Parea=adminapp \
  -Pfeature=user-profile \
  -Pscenario="User can open the profile page" \
  -Ppath=/profile \
  -PtaskSuffix=AdminApp \
  -Pmode=interactive \
  --console=plain \
  --no-daemon \
  -Dbase.url=https://playwright.dev
```

Fixture mode is for unattended validation or when a `recording.java` already exists. It never launches Playwright codegen:

```bash
./gradlew :test-suite:onboardCase \
  -Parea=adminapp \
  -Pfeature=user-profile \
  -Pscenario="User can open the profile page" \
  -Ppath=/profile \
  -PtaskSuffix=AdminApp \
  -Pfixture=/absolute/path/to/recording.java \
  --console=plain \
  --no-daemon \
  -Dbase.url=https://playwright.dev
```

Equivalent shell wrapper commands:

```bash
tools/case-recorder/bin/onboard-case.sh --help
tools/case-recorder/bin/onboard-case.sh \
  --area adminapp \
  --feature user-profile \
  --scenario "User can open the profile page" \
  --path /profile \
  --base-url https://playwright.dev \
  --task-suffix AdminApp \
  --dry-run
tools/case-recorder/bin/onboard-case.sh \
  --area adminapp \
  --feature user-profile \
  --scenario "User can open the profile page" \
  --path /profile \
  --base-url https://playwright.dev \
  --task-suffix AdminApp \
  --mode interactive
tools/case-recorder/bin/onboard-case.sh \
  --area adminapp \
  --feature user-profile \
  --scenario "User can open the profile page" \
  --path /profile \
  --base-url https://playwright.dev \
  --task-suffix AdminApp \
  --fixture /absolute/path/to/recording.java
```

Windows `cmd.exe` wrapper commands use the same options:

```bat
tools\case-recorder\bin\onboard-case.cmd --area adminapp --feature user-profile --scenario "User can open the profile page" --path /profile --base-url https://playwright.dev --task-suffix AdminApp --dry-run
tools\case-recorder\bin\onboard-case.cmd --area adminapp --feature user-profile --scenario "User can open the profile page" --path /profile --base-url https://playwright.dev --task-suffix AdminApp --mode interactive
tools\case-recorder\bin\onboard-case.cmd --area adminapp --feature user-profile --scenario "User can open the profile page" --path /profile --base-url https://playwright.dev --task-suffix AdminApp --fixture C:\path\to\recording.java
```

## Generated and Updated Outputs

A successful new-area onboarding run creates or updates only the planned scaffold:

```text
test-suite/src/test/resources/features/<area>/<feature>.feature
test-suite/src/test/java/com/example/e2e/tests/steps/<area>/<FeaturePascal>Steps.java
test-suite/src/test/java/com/example/e2e/tests/runner/<area>/<TaskSuffix>RunCucumberTest.java
test-suite/build.gradle                                  # safe cucumberAreas registration
test-suite/build/case-drafts/<area>/<feature>/recording.java
test-suite/build/case-drafts/<area>/<feature>/metadata.json
test-suite/build/case-drafts/<area>/<feature>/case-draft.json
test-suite/build/case-drafts/<area>/<feature>/draft-summary.md
```

The `cucumberAreas` registration must include the generated `taskName` (`test<TaskSuffix>`), `taskSuffix`, `runnerClassName`, glue for core hooks/common steps/area steps, base URL or documented default, `parallelEnabled: false`, `parallelism: 1`, and `explore` defaults.

For an existing registered area, onboarding reuses the runner and Gradle registration when they match framework defaults, then creates only the new feature, step draft, and draft metadata.

## Safety and Idempotency Rules

- Preflight and scaffold conflict checks run before recording/codegen writes.
- Default execution never overwrites existing source files.
- `--dry-run` / `-PdryRun=true` is truthful no-write planning and does not launch Playwright codegen.
- `--force` / `-Pforce=true` is narrow: it can refresh generated-owned feature/step drafts only when `metadata.json` contains matching ownership evidence. It does not destructively replace runner classes or `test-suite/build.gradle`.
- Runner, Gradle registration, mismatched glue, runner-only, Gradle-only, or feature-without-step conflicts fail with manual-merge guidance and leave files unchanged.
- Keep `test-suite/build/case-drafts/**`, Playwright recordings, screenshots/videos, Allure output, and dependency directories out of commits.

## Review and Promotion Requirements

Generated feature files are tagged `@draft`. Treat the feature, step class, `case-draft.json`, and `draft-summary.md` as review material until a human checks:

- scenario wording and business intent;
- generated navigation and selector assumptions;
- supported action mappings through `steps/common/DraftInteractionSteps.java`;
- unsupported recorded actions, which generate explicit failing step definitions;
- app-specific interactions needed before promotion;
- the next validation command printed in the terminal summary.

Do not promote generated drafts to production-ready tests until unsupported actions and uncertain generated behavior are reviewed and resolved.

## Validation

Run recorder/tool checks after changing or using the onboarding flow:

```bash
./gradlew :test-suite:caseRecorderCheck :test-suite:caseRecorderTest --console=plain --no-daemon
```

Run the fixture smoke to validate the complete new-area path without manual browser interaction. It creates a disposable workspace, generates `smokeapp`, verifies `testSmokeApp` task discovery and `testAllApps --dry-run`, compiles test classes, runs the generated area headlessly, and removes the workspace:

```bash
./gradlew :test-suite:caseRecorderOnboardingSmoke --console=plain --no-daemon
```

After generating a real area, run the task printed by onboarding, then compile:

```bash
./gradlew :test-suite:testAdminApp --console=plain --no-daemon -Dheadless=true
./gradlew :core:compileJava :test-suite:testClasses --console=plain --no-daemon
```

If framework-level runtime or shared steps changed, also run:

```bash
./gradlew :test-suite:testAllApps --console=plain --no-daemon -Dheadless=true
```

## Legacy Compatibility

Existing split recorder commands remain available for already registered areas:

```bash
./gradlew :test-suite:recordCase -Parea=demoapp -Pfeature=getting-started -Pscenario="User can open the guide" -Ppath=/ --console=plain --no-daemon
./gradlew :test-suite:generateCaseFromRecording -Parea=demoapp -Pfeature=getting-started --console=plain --no-daemon
./gradlew :test-suite:generateCase -Parea=demoapp -Pfeature=getting-started --console=plain --no-daemon
```

Prefer `:test-suite:onboardCase` for new areas because it performs preflight, recording or fixture ingestion, feature/steps generation, runner creation, safe `cucumberAreas` registration, draft metadata output, and next-command validation in one flow.
