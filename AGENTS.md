# Repository Guidelines

## Project Structure & Module Organization

This is a Java 21, Gradle, Playwright Java, Cucumber JVM, and JUnit Platform E2E framework. `settings.gradle` includes two modules: `core` for reusable framework behavior and `test-suite` for executable scenarios.

- `core/src/main/java/com/example/e2e/core`: configuration, scenario context, Cucumber hooks, Playwright lifecycle, and artifact naming.
- `test-suite/src/test/java/com/example/e2e/tests`: Cucumber runners and step definitions.
- `test-suite/src/test/resources/features`: feature files grouped by area, for example `common/` and `demoapp/`.
- `docs/`: onboarding and design notes. Do not commit generated `build/` artifacts.

Keep browser/session lifecycle and shared runtime toggles in `core`. Keep app-specific selectors, assertions, and feature behavior in `test-suite`.

## Build, Test, and Development Commands

The repo intentionally omits `gradle-wrapper.jar`; generate it locally with `gradle wrapper` if needed.

```bash
./gradlew clean test                 # run the full Cucumber suite
./gradlew :test-suite:testCommon     # run common feature area
./gradlew :test-suite:testDemoApp    # run demo app feature area
./gradlew :test-suite:testAllApps    # run all area-specific tasks
./gradlew :test-suite:allureReport   # generate Allure report
```

Override runtime settings with system properties, for example `-Dbase.url=https://playwright.dev -Dheadless=true`.

## Coding Style & Naming Conventions

Use Java 21 conventions, four-space indentation, and package names under `com.example.e2e`. Do not create `Playwright`, `Browser`, or `Page` directly in step definitions; use `PlaywrightManager`. Prefer stable Playwright locators and avoid `Thread.sleep(...)`. Add new runtime toggles through `FrameworkConfig`, not ad hoc `System.getProperty` calls.

## Testing Guidelines

Feature files live under `features/<area>/`; matching steps live under `steps/<area>/`. When adding a new area, also add its runner and `cucumberAreas` entry in `test-suite/build.gradle` so `:test-suite:testAllApps` and the narrow area task include it; see `docs/new-app-onboarding.md`. Cross-app steps belong in `steps/common`. Use explicit JUnit Jupiter assertions with clear failure messages. For framework changes, run the full suite; for feature or step changes, run the narrowest relevant area first.

## Commit & Pull Request Guidelines

Recent history uses short imperative messages such as `chore: record journal` and `Align repository with E2E framework snapshot`. Keep commits focused, explain why behavior changed, and exclude generated artifacts. Pull requests should summarize scope, list validation commands, mention affected feature areas, and include screenshots or Allure links when UI behavior changes.

## Security & Configuration Tips

Windows defaults to local-browser mode and `msedge` for Chromium. For UI exploration, use Windsurf with the approved `@playwright/cli` package and `FIRM_NPM_REGISTRY`; keep generated snapshots, videos, and scratch TypeScript out of version control.
