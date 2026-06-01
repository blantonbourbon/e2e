# Record a New Playwright Java/Cucumber Case

Use this workflow for **record-first onboarding of new Playwright/Cucumber cases** in this repository. Do not use it as the default Cypress migration path; Cypress conversion is source-based and documented in `/cypress-to-playwright-java`.

## 0. Pick the Correct Workflow

- New case or new app area from browser actions: continue here.
- Cypress source migration: use `.windsurf/workflows/cypress-to-playwright-java.md` and `.codex/skills/migrate-cypress-to-playwright-java/SKILL.md`.

## 1. Discover and Preflight

From the repo root:

```bash
./gradlew :test-suite:tasks --all --console=plain --no-daemon
./gradlew :test-suite:onboardCase -Phelp=true --console=plain --no-daemon
node tools/case-recorder/src/onboard.mjs --help
```

Run preflight before planning or recording:

```bash
. tools/case-recorder/bin/env.sh
sh tools/case-recorder/bin/doctor.sh
./gradlew :test-suite:caseRecorderCheck --console=plain --no-daemon
```

WSL caveat near the command: use WSL-local Node.js, npm, and Java 21. The doctor rejects Windows-backed executables like `/mnt/c/.../npm`; keep the checkout, fixture recordings, and draft output on the Linux filesystem to avoid `/mnt/c` slowness, locks, and CRLF surprises.

Windows caveat near the command: run from a Windows-local checkout, not `\\wsl.localhost\...`, and use the `.cmd` helper:

```bat
call tools\case-recorder\bin\env.cmd
gradlew.bat :test-suite:caseRecorderCheck --console=plain --no-daemon
tools\case-recorder\bin\onboard-case.cmd --help
tools\case-recorder\bin\onboard-case.cmd --area adminapp --feature user-profile --scenario "User can open the profile page" --path /profile --base-url https://playwright.dev --task-suffix AdminApp --dry-run
```

The Java framework defaults Windows Chromium runs to local browser mode and `msedge`; override with `-Dbrowser.channel` or `-Dbrowser.executable.path` only when needed.

## 2. Dry-Run the Complete Plan

Dry-run is mandatory before a new area because it prints every source file, draft artifact, Gradle registration update, task name, skip, and conflict without writing anything or launching codegen:

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

If the plan reports a runner or Gradle conflict, stop and manually merge. Do not rerun with force for runner or `test-suite/build.gradle` conflicts.

## 3. Choose Recording Mode

### Interactive mode

Interactive mode opens Playwright codegen at the resolved URL and writes `recording.java` plus metadata before generating the scaffold. Close the codegen window when the flow is complete:

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

Equivalent shell wrapper:

```bash
tools/case-recorder/bin/onboard-case.sh \
  --area adminapp \
  --feature user-profile \
  --scenario "User can open the profile page" \
  --path /profile \
  --base-url https://playwright.dev \
  --task-suffix AdminApp \
  --mode interactive
```

### Fixture mode

Fixture mode consumes an existing Java Playwright recording and does not launch a browser/codegen window. Use it for unattended validation or repeatable scaffolding:

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

Equivalent shell wrapper:

```bash
tools/case-recorder/bin/onboard-case.sh \
  --area adminapp \
  --feature user-profile \
  --scenario "User can open the profile page" \
  --path /profile \
  --base-url https://playwright.dev \
  --task-suffix AdminApp \
  --fixture /absolute/path/to/recording.java
```

## 4. Review Generated Outputs

For a new area, expect the plan and summary to list:

```text
test-suite/src/test/resources/features/<area>/<feature>.feature
test-suite/src/test/java/com/example/e2e/tests/steps/<area>/<FeaturePascal>Steps.java
test-suite/src/test/java/com/example/e2e/tests/runner/<area>/<TaskSuffix>RunCucumberTest.java
test-suite/build.gradle
test-suite/build/case-drafts/<area>/<feature>/recording.java
test-suite/build/case-drafts/<area>/<feature>/metadata.json
test-suite/build/case-drafts/<area>/<feature>/case-draft.json
test-suite/build/case-drafts/<area>/<feature>/draft-summary.md
```

`test-suite/build.gradle` receives a safe `cucumberAreas` entry with `taskName`, `taskSuffix`, `runnerClassName`, core/common/area glue, base URL/defaults, `parallelEnabled: false`, `parallelism: 1`, and `explore` defaults. Existing registered areas are reused instead of duplicated when their runner and Gradle registration are safe.

## 5. Safety Rules

- Default execution refuses to overwrite source files.
- `-PdryRun=true` / `--dry-run` writes nothing and does not launch codegen.
- `-Pforce=true` / `--force` only refreshes generated-owned feature/step drafts when `metadata.json` ownership evidence matches. It does not force runner or Gradle registration changes.
- Partial scaffold states that are unsafe, including runner-only, Gradle-only, mismatched glue, and existing feature-without-steps, fail before writes with manual-merge guidance.
- Keep `test-suite/build/case-drafts/**`, raw recordings, screenshots/videos, Allure results, and dependency directories out of version control.

## 6. Manual Review Gate

Generated cases are drafts. Before promotion:

- inspect the generated `@draft` feature language;
- read `case-draft.json` and `draft-summary.md`;
- implement or rewrite unsupported generated actions that intentionally fail in the step class;
- replace generic draft interaction steps with app-specific business language where appropriate;
- confirm generated selectors, URL/path resolution, and assertions are correct;
- remove `@draft` only after the scenario is stable and validated.

Do not treat generated drafts as production-ready tests without this review.

## 7. Validate

Run recorder checks:

```bash
./gradlew :test-suite:caseRecorderCheck :test-suite:caseRecorderTest --console=plain --no-daemon
```

Run the fixture smoke when changing the workflow or before trusting unattended generation. It creates a disposable workspace, uses a synthetic fixture recording, runs `:test-suite:onboardCase`, verifies `testSmokeApp` discovery and `testAllApps --dry-run`, compiles test classes, runs the generated area headlessly, and removes the workspace:

```bash
./gradlew :test-suite:caseRecorderOnboardingSmoke --console=plain --no-daemon
```

For a real generated area, run the next command printed by onboarding, for example:

```bash
./gradlew :test-suite:testAdminApp --console=plain --no-daemon -Dheadless=true
./gradlew :core:compileJava :test-suite:testClasses --console=plain --no-daemon
```

If shared framework behavior changed, finish with:

```bash
./gradlew :test-suite:testAllApps --console=plain --no-daemon -Dheadless=true
```

## 8. Legacy Split Commands

The legacy two-step recorder remains available for existing registered areas:

```bash
./gradlew :test-suite:recordCase -Parea=demoapp -Pfeature=getting-started -Pscenario="User can open the guide" -Ppath=/ --console=plain --no-daemon
./gradlew :test-suite:generateCaseFromRecording -Parea=demoapp -Pfeature=getting-started --console=plain --no-daemon
./gradlew :test-suite:generateCase -Parea=demoapp -Pfeature=getting-started --console=plain --no-daemon
```

Prefer `:test-suite:onboardCase` for new areas or cases that need complete runner, Gradle task, feature, steps, and draft metadata generation in one flow.
