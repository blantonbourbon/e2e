# Add Sample app1 Cucumber Scaffold

## Goal

Add a minimal runnable sample application test scaffold in the `test-suite` module using Cucumber JVM, with the requested Java package layout under `src/test/java/app1/steps` and `src/test/java/app1/runner`.

## Requirements

- Add the minimum Gradle test dependencies needed to run a Cucumber JVM suite on JUnit Platform in `:test-suite`.
- Keep the existing `TestSuiteSmokeTest` working.
- Add a runner class under `test-suite/src/test/java/app1/runner/`.
- Add step definitions under `test-suite/src/test/java/app1/steps/`.
- Add the minimal test resources required to execute the sample app suite.
- Keep the sample simple and consistent with the current repo conventions.

## Acceptance Criteria

- [ ] `:test-suite` contains a runnable sample Cucumber suite for `app1`.
- [ ] The Java package layout includes `app1.runner` and `app1.steps`.
- [ ] A feature file exists for the sample app.
- [ ] The sample proves `:test-suite` can execute Cucumber-based tests while still depending on `:core`.
- [ ] Existing smoke coverage remains intact.

## Technical Notes

- Use JUnit Platform as the test engine entry point.
- Use Allure-compatible Cucumber integration.
- Keep step definitions thin and avoid introducing shared static state.
