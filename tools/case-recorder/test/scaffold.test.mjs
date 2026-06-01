import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  applyScaffoldPlan,
  planCaseScaffold,
  resolveCaseTarget
} from "../src/scaffold.mjs";
import { createAreaConfig, renderUpdatedBuildGradle } from "../src/gradle-areas.mjs";
import { renderRunner } from "../src/scaffold-render.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const sourceBuildGradle = path.join(repoRoot, "test-suite", "build.gradle");

const supportedRecording = `
  page.navigate("https://app.example.test/profile");
  page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Save")).click();
  assertThat(page.getByText("Saved")).isVisible();
`;

test("plans and generates a complete new-area scaffold with runtime defaults", async () => {
  const repo = await createTempRepo();
  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", "user-profile");

  const plan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "adminapp",
    feature: "user-profile",
    scenario: "User updates their profile",
    baseUrl: "https://app.example.test",
    path: "/profile",
    taskSuffix: "AdminApp",
    recording: supportedRecording
  });

  assert.equal(plan.area.existing, false);
  assert.equal(plan.area.taskName, "testAdminApp");
  assert.equal(plan.area.runnerClassName, "AdminAppRunCucumberTest");
  assert.equal(plan.stepClassName, "UserProfileSteps");
  assert.equal(plan.target.resolvedUrl, "https://app.example.test/profile");

  const result = await applyScaffoldPlan(plan);
  assert.match(result.summary, /Generated .*user-profile\.feature/);
  assert.match(result.summary, /Updated .*test-suite\/build\.gradle/);
  assert.match(result.summary, /Next validation command: \.\/gradlew :test-suite:testAdminApp/);

  const feature = await readFile(path.join(
    repo,
    "test-suite/src/test/resources/features/adminapp/user-profile.feature"
  ), "utf8");
  assert.match(feature, /@adminapp @draft/);
  assert.match(feature, /Scenario: User updates their profile/);
  assert.match(feature, /Given the user opens the relative path "\/profile"/);
  assert.match(feature, /When the user clicks the button named "Save"/);

  const steps = await readFile(path.join(
    repo,
    "test-suite/src/test/java/com/example/e2e/tests/steps/adminapp/UserProfileSteps.java"
  ), "utf8");
  assert.match(steps, /package com\.example\.e2e\.tests\.steps\.adminapp;/);
  assert.match(steps, /public class UserProfileSteps/);
  assert.doesNotMatch(steps, /\b(?:Playwright|Browser|Page)\b/);

  const runner = await readFile(path.join(
    repo,
    "test-suite/src/test/java/com/example/e2e/tests/runner/adminapp/AdminAppRunCucumberTest.java"
  ), "utf8");
  assert.match(runner, /package com\.example\.e2e\.tests\.runner\.adminapp;/);
  assert.match(runner, /@SelectClasspathResource\("features\/adminapp"\)/);
  assert.match(runner, /public class AdminAppRunCucumberTest/);

  const buildGradle = await readFile(path.join(repo, "test-suite/build.gradle"), "utf8");
  assert.match(buildGradle, /adminapp:\s*\[/);
  assert.match(buildGradle, /taskName\s*:\s*'testAdminApp'/);
  assert.match(buildGradle, /taskSuffix\s*:\s*'AdminApp'/);
  assert.match(buildGradle, /baseUrl\s*:\s*'https:\/\/app\.example\.test'/);
  assert.match(buildGradle, /runnerClassName:\s*'com\.example\.e2e\.tests\.runner\.adminapp\.AdminAppRunCucumberTest'/);
  assert.match(buildGradle, /'com\.example\.e2e\.core\.hooks'/);
  assert.match(buildGradle, /'com\.example\.e2e\.tests\.steps\.common'/);
  assert.match(buildGradle, /'com\.example\.e2e\.tests\.steps\.adminapp'/);
  assert.match(buildGradle, /parallelEnabled:\s*false/);
  assert.match(buildGradle, /parallelism\s*:\s*1/);
  assert.match(buildGradle, /explore\s*:\s*\[/);
  assert.match(buildGradle, /enabled\s*:\s*true/);
  assert.match(buildGradle, /path\s*:\s*'\/profile'/);
  assert.match(buildGradle, /testIdAttribute:\s*'data-testid'/);

  const metadata = JSON.parse(await readFile(path.join(draftDir, "metadata.json"), "utf8"));
  const draft = JSON.parse(await readFile(path.join(draftDir, "case-draft.json"), "utf8"));
  const summary = await readFile(path.join(draftDir, "draft-summary.md"), "utf8");
  assert.equal(metadata.area, "adminapp");
  assert.equal(metadata.feature, "user-profile");
  assert.equal(metadata.taskName, "testAdminApp");
  assert.equal(metadata.baseUrl, "https://app.example.test");
  assert.equal(metadata.path, "/profile");
  assert.equal(metadata.resolvedUrl, "https://app.example.test/profile");
  assert.equal(metadata.nextValidationCommand, "./gradlew :test-suite:testAdminApp --console=plain --no-daemon -Dheadless=true");
  assert.deepEqual(draft.steps, metadata.steps);
  assert.equal(draft.resolvedUrl, metadata.resolvedUrl);
  assert.ok(metadata.generatedFiles.some((file) => file.endsWith("AdminAppRunCucumberTest.java")));
  assert.match(summary, /## Generated Files/);
  assert.match(summary, /## Review Work/);
  assert.match(summary, /Next validation command/);
  assert.match(summary, /testAdminApp/);
});

test("reuses an existing registered area without duplicate runner or Gradle entry", async () => {
  const repo = await createTempRepo();
  await copyRegisteredRunner(repo, "demoapp", "DemoAppRunCucumberTest");
  const originalBuildGradle = await readFile(path.join(repo, "test-suite/build.gradle"), "utf8");
  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "demoapp", "fresh-case");

  const plan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "demoapp",
    feature: "fresh-case",
    scenario: "User opens a fresh case",
    baseUrl: "https://playwright.dev",
    path: "/docs/intro",
    recording: ""
  });

  assert.equal(plan.area.existing, true);
  assert.equal(plan.area.taskName, "testDemoApp");
  assert.equal(plan.operations.find((operation) => operation.kind === "runner")?.status, "skip");
  assert.equal(plan.operations.find((operation) => operation.kind === "gradle-registration")?.status, "skip");

  const result = await applyScaffoldPlan(plan);
  assert.match(result.summary, /Reused registered area demoapp \(testDemoApp\)/);
  assert.match(result.summary, /Skipped \[skip] runner/);
  assert.match(result.summary, /Skipped \[skip] gradle-registration/);
  assert.equal(await readFile(path.join(repo, "test-suite/build.gradle"), "utf8"), originalBuildGradle);
  assert.equal(
    existsSync(path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/runner/demoapp/DemoAppRunCucumberTest.java")),
    true
  );
  assert.equal(
    existsSync(path.join(repo, "test-suite/src/test/resources/features/demoapp/fresh-case.feature")),
    true
  );
  assert.equal(
    existsSync(path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/steps/demoapp/FreshCaseSteps.java")),
    true
  );
});

test("rejects existing registered runners with extra classpath resource selectors", async () => {
  const repo = await createTempRepo();
  await registerAdminArea(repo);
  const runnerPath = path.join(
    repo,
    "test-suite/src/test/java/com/example/e2e/tests/runner/adminapp/AdminAppRunCucumberTest.java"
  );
  await mkdir(path.dirname(runnerPath), { recursive: true });
  await writeFile(runnerPath, `package com.example.e2e.tests.runner.adminapp;

import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/adminapp")
@SelectClasspathResource("features/common")
public class AdminAppRunCucumberTest {
}
`, "utf8");
  const before = await snapshotTree(repo);

  const plan = await planCaseScaffold({
    repoRoot: repo,
    draftDir: path.join(repo, "test-suite/build/case-drafts/adminapp/user-profile"),
    area: "adminapp",
    feature: "user-profile",
    scenario: "User opens profile",
    recording: supportedRecording
  });

  assert.equal(plan.conflicts.find((operation) => operation.kind === "runner")?.status, "conflict");
  assert.match(
    plan.conflicts.find((operation) => operation.kind === "runner")?.reason,
    /runner must select exactly features\/adminapp/
  );
  await assert.rejects(() => applyScaffoldPlan(plan), /features\/common/);
  assert.deepEqual(await snapshotTree(repo), before);
});

test("rejects existing runners whose classpath selector only appears in comments", async () => {
  const repo = await createTempRepo();
  await registerAdminArea(repo);
  const runnerPath = path.join(
    repo,
    "test-suite/src/test/java/com/example/e2e/tests/runner/adminapp/AdminAppRunCucumberTest.java"
  );
  await mkdir(path.dirname(runnerPath), { recursive: true });
  await writeFile(runnerPath, `package com.example.e2e.tests.runner.adminapp;

import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.Suite;

@Suite
@IncludeEngines("cucumber")
// @SelectClasspathResource("features/adminapp")
public class AdminAppRunCucumberTest {
}
`, "utf8");

  const plan = await planCaseScaffold({
    repoRoot: repo,
    draftDir: path.join(repo, "test-suite/build/case-drafts/adminapp/user-profile"),
    area: "adminapp",
    feature: "user-profile",
    scenario: "User opens profile",
    recording: supportedRecording
  });

  assert.equal(plan.conflicts.find((operation) => operation.kind === "runner")?.status, "conflict");
  assert.match(
    plan.conflicts.find((operation) => operation.kind === "runner")?.reason,
    /runner must select exactly features\/adminapp/
  );
});

test("validates deterministic names before planning writes", async () => {
  const repo = await createTempRepo();
  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", "user-profile");

  await assert.rejects(
    () => planCaseScaffold({
      repoRoot: repo,
      draftDir,
      area: "admin-app",
      feature: "user-profile",
      scenario: "User opens profile",
      recording: ""
    }),
    /area must match/
  );
  await assert.rejects(
    () => planCaseScaffold({
      repoRoot: repo,
      draftDir,
      area: "adminapp",
      feature: "User Profile",
      scenario: "User opens profile",
      recording: ""
    }),
    /feature must match/
  );
  await assert.rejects(
    () => planCaseScaffold({
      repoRoot: repo,
      draftDir,
      area: "adminapp",
      feature: "user-profile",
      taskSuffix: "admin-app",
      scenario: "User opens profile",
      recording: ""
    }),
    /task suffix must match/
  );

  assert.equal(existsSync(path.join(repo, "test-suite/src/test/resources/features/admin-app")), false);

  const plan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "adminapp",
    feature: "user-profile",
    taskSuffix: "AdminApp",
    scenario: "User opens profile",
    recording: ""
  });
  assert.equal(plan.area.taskName, "testAdminApp");
  assert.equal(plan.area.runnerClassName, "AdminAppRunCucumberTest");
  assert.equal(plan.stepClassName, "UserProfileSteps");
});

test("resolves base URL and path consistently for relative and absolute targets", () => {
  assert.deepEqual(resolveCaseTarget({
    baseUrl: "https://app.example.test/root/",
    path: "profile?tab=settings"
  }), {
    baseUrl: "https://app.example.test/root/",
    path: "profile?tab=settings",
    navigationTarget: "profile?tab=settings",
    resolvedUrl: "https://app.example.test/root/profile?tab=settings"
  });

  assert.deepEqual(resolveCaseTarget({
    baseUrl: "https://app.example.test/root/",
    path: "/profile?tab=settings"
  }), {
    baseUrl: "https://app.example.test/root/",
    path: "/profile?tab=settings",
    navigationTarget: "/profile?tab=settings",
    resolvedUrl: "https://app.example.test/profile?tab=settings"
  });

  assert.deepEqual(resolveCaseTarget({
    baseUrl: "https://app.example.test/root/",
    path: "/"
  }), {
    baseUrl: "https://app.example.test/root/",
    path: "/",
    navigationTarget: "/",
    resolvedUrl: "https://app.example.test/"
  });

  assert.deepEqual(resolveCaseTarget({
    baseUrl: "https://app.example.test/root/",
    path: ""
  }), {
    baseUrl: "https://app.example.test/root/",
    path: "",
    navigationTarget: "",
    resolvedUrl: "https://app.example.test/root/"
  });

  assert.deepEqual(resolveCaseTarget({
    baseUrl: "https://app.example.test",
    path: "https://other.example.test/deep/link"
  }), {
    baseUrl: "https://app.example.test",
    path: "https://other.example.test/deep/link",
    navigationTarget: "https://other.example.test/deep/link",
    resolvedUrl: "https://other.example.test/deep/link"
  });
});

test("aligns metadata summaries and generated steps with path-prefixed base URLs", async () => {
  const repo = await createTempRepo();
  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", "profile-settings");
  const recording = `
    page.navigate("https://app.example.test/root/profile?tab=settings");
    assertThat(page).hasTitle(Pattern.compile(".*Profile.*"));
  `;

  const plan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "adminapp",
    feature: "profile-settings",
    scenario: "User opens profile settings",
    baseUrl: "https://app.example.test/root/",
    path: "profile?tab=settings",
    taskSuffix: "AdminApp",
    recording
  });

  assert.equal(plan.target.navigationTarget, "profile?tab=settings");
  assert.equal(plan.target.resolvedUrl, "https://app.example.test/root/profile?tab=settings");

  const result = await applyScaffoldPlan(plan);
  assert.match(result.summary, /Resolved URL: https:\/\/app\.example\.test\/root\/profile\?tab=settings/);

  const feature = await readFile(path.join(
    repo,
    "test-suite/src/test/resources/features/adminapp/profile-settings.feature"
  ), "utf8");
  assert.match(feature, /Given the user opens the relative path "profile\?tab=settings"/);

  const metadata = JSON.parse(await readFile(path.join(draftDir, "metadata.json"), "utf8"));
  const draft = JSON.parse(await readFile(path.join(draftDir, "case-draft.json"), "utf8"));
  const summary = await readFile(path.join(draftDir, "draft-summary.md"), "utf8");
  assert.equal(metadata.path, "profile?tab=settings");
  assert.equal(metadata.resolvedUrl, "https://app.example.test/root/profile?tab=settings");
  assert.deepEqual(draft.steps, metadata.steps);
  assert.ok(metadata.steps.includes('Given the user opens the relative path "profile?tab=settings"'));
  assert.match(summary, /- Path: profile\?tab=settings/);
  assert.match(summary, /- Resolved URL: https:\/\/app\.example\.test\/root\/profile\?tab=settings/);
  assert.match(metadata.terminalSummary, /Resolved URL: https:\/\/app\.example\.test\/root\/profile\?tab=settings/);
});

test("plans absolute leading-slash root and empty targets consistently with path-prefixed base URLs", async () => {
  const cases = [
    {
      feature: "absolute-target",
      path: "https://other.example.test/profile?tab=settings",
      resolvedUrl: "https://other.example.test/profile?tab=settings",
      step: 'Given the user opens the relative path "https://other.example.test/profile?tab=settings"'
    },
    {
      feature: "leading-slash-target",
      path: "/profile?tab=settings",
      resolvedUrl: "https://app.example.test/profile?tab=settings",
      step: 'Given the user opens the relative path "/profile?tab=settings"'
    },
    {
      feature: "root-target",
      path: "/",
      resolvedUrl: "https://app.example.test/",
      step: 'Given the user opens the relative path "/"'
    },
    {
      feature: "empty-target",
      path: "",
      resolvedUrl: "https://app.example.test/root/",
      step: 'Given the user opens the relative path ""'
    }
  ];

  for (const caseData of cases) {
    const repo = await createTempRepo();
    const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", caseData.feature);
    const plan = await planCaseScaffold({
      repoRoot: repo,
      draftDir,
      area: "adminapp",
      feature: caseData.feature,
      scenario: `User opens ${caseData.feature}`,
      baseUrl: "https://app.example.test/root/",
      path: caseData.path,
      taskSuffix: "AdminApp",
      recording: ""
    });

    assert.equal(plan.metadata.path, caseData.path);
    assert.equal(plan.metadata.resolvedUrl, caseData.resolvedUrl);
    assert.equal(plan.draft.resolvedUrl, caseData.resolvedUrl);
    assert.deepEqual(plan.metadata.steps, [caseData.step]);
    assert.match(plan.operations.find((operation) => operation.kind === "draft-summary").contents, new RegExp(escapeRegExp(caseData.resolvedUrl)));
  }
});

test("refuses source conflicts before writing any scaffold files", async () => {
  const repo = await createTempRepo();
  const existingFeaturePath = path.join(
    repo,
    "test-suite/src/test/resources/features/adminapp/user-profile.feature"
  );
  await mkdir(path.dirname(existingFeaturePath), { recursive: true });
  await writeFile(existingFeaturePath, "Feature: manual\n", "utf8");

  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", "user-profile");
  const plan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "adminapp",
    feature: "user-profile",
    taskSuffix: "AdminApp",
    scenario: "User opens profile",
    recording: ""
  });

  assert.equal(plan.conflicts.length, 1);
  await assert.rejects(() => applyScaffoldPlan(plan), /Refusing to write scaffold with conflicts/);
  assert.equal(await readFile(existingFeaturePath, "utf8"), "Feature: manual\n");
  assert.equal(
    existsSync(path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/steps/adminapp/UserProfileSteps.java")),
    false
  );
  assert.equal(
    existsSync(path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/runner/adminapp/AdminAppRunCucumberTest.java")),
    false
  );
});

test("dry-run reports every planned change without modifying files or git status", async () => {
  const repo = await createTempRepo();
  initializeGitRepo(repo);
  const beforeSnapshot = await snapshotTree(repo);
  const beforeStatus = gitStatus(repo);
  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", "user-profile");

  const plan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "adminapp",
    feature: "user-profile",
    taskSuffix: "AdminApp",
    scenario: "User opens profile",
    baseUrl: "https://app.example.test",
    path: "/profile",
    recording: supportedRecording
  });

  const result = await applyScaffoldPlan(plan, { dryRun: true });

  assert.equal(result.written.length, 0);
  assert.match(result.summary, /Would create \[create].*user-profile\.feature/);
  assert.match(result.summary, /Would create \[create].*UserProfileSteps\.java/);
  assert.match(result.summary, /Would create \[create].*AdminAppRunCucumberTest\.java/);
  assert.match(result.summary, /Would update \[update].*test-suite\/build\.gradle/);
  assert.match(result.summary, /Would create \[create].*metadata\.json/);
  assert.match(result.summary, /Would create \[create].*case-draft\.json/);
  assert.match(result.summary, /Would create \[create].*draft-summary\.md/);
  assert.match(result.summary, /Gradle task: testAdminApp/);
  assert.deepEqual(await snapshotTree(repo), beforeSnapshot);
  assert.equal(gitStatus(repo), beforeStatus);
  assert.equal(existsSync(path.join(
    repo,
    "test-suite/src/test/resources/features/adminapp/user-profile.feature"
  )), false);
  assert.equal(existsSync(path.join(draftDir, "metadata.json")), false);
});

test("default execution refuses existing source conflicts and preserves checksums", async () => {
  const repo = await createTempRepo();
  const featurePath = path.join(repo, "test-suite/src/test/resources/features/adminapp/user-profile.feature");
  const stepsPath = path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/steps/adminapp/UserProfileSteps.java");
  const runnerPath = path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/runner/adminapp/AdminAppRunCucumberTest.java");
  await mkdir(path.dirname(featurePath), { recursive: true });
  await mkdir(path.dirname(stepsPath), { recursive: true });
  await mkdir(path.dirname(runnerPath), { recursive: true });
  await writeFile(featurePath, "Feature: manual feature\n", "utf8");
  await writeFile(stepsPath, "package manual;\npublic class UserProfileSteps {}\n", "utf8");
  await writeFile(runnerPath, renderRunner("adminapp", "AdminAppRunCucumberTest"), "utf8");
  const before = await checksumMap([featurePath, stepsPath, runnerPath, path.join(repo, "test-suite/build.gradle")]);

  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", "user-profile");
  const plan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "adminapp",
    feature: "user-profile",
    taskSuffix: "AdminApp",
    scenario: "User opens profile",
    recording: supportedRecording
  });

  assert.deepEqual(
    plan.conflicts.map((operation) => operation.kind).sort(),
    ["feature", "runner", "steps"]
  );
  await assert.rejects(
    () => applyScaffoldPlan(plan),
    /Refusing to write scaffold with conflicts:[\s\S]*default onboarding never overwrites source files/
  );
  assert.deepEqual(await checksumMap([featurePath, stepsPath, runnerPath, path.join(repo, "test-suite/build.gradle")]), before);
  assert.equal(existsSync(path.join(draftDir, "metadata.json")), false);
});

test("force refreshes only generated-owned feature and steps", async () => {
  const repo = await createTempRepo();
  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", "country");
  const firstPlan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "adminapp",
    feature: "country",
    taskSuffix: "AdminApp",
    scenario: "User selects United States",
    recording: 'page.locator("[data-testid=\'country\']").selectOption("US");'
  });
  await applyScaffoldPlan(firstPlan);
  const buildGradlePath = path.join(repo, "test-suite/build.gradle");
  const runnerPath = path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/runner/adminapp/AdminAppRunCucumberTest.java");
  const beforeImmutable = await checksumMap([buildGradlePath, runnerPath]);

  const secondPlan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "adminapp",
    feature: "country",
    taskSuffix: "AdminApp",
    scenario: "User selects Canada",
    recording: 'page.locator("[data-testid=\'country\']").selectOption("CA");',
    force: true
  });
  assert.deepEqual(secondPlan.conflicts, []);
  assert.equal(secondPlan.operations.find((operation) => operation.kind === "feature")?.status, "overwrite");
  assert.equal(secondPlan.operations.find((operation) => operation.kind === "steps")?.status, "overwrite");
  assert.equal(secondPlan.operations.find((operation) => operation.kind === "runner")?.status, "skip");
  assert.equal(secondPlan.operations.find((operation) => operation.kind === "gradle-registration")?.status, "skip");

  const result = await applyScaffoldPlan(secondPlan);
  assert.match(result.summary, /Updated \[overwrite].*country\.feature/);
  assert.match(result.summary, /Updated \[overwrite].*CountrySteps\.java/);
  assert.deepEqual(await checksumMap([buildGradlePath, runnerPath]), beforeImmutable);

  const feature = await readFile(path.join(repo, "test-suite/src/test/resources/features/adminapp/country.feature"), "utf8");
  const steps = await readFile(path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/steps/adminapp/CountrySteps.java"), "utf8");
  const metadata = JSON.parse(await readFile(path.join(draftDir, "metadata.json"), "utf8"));
  assert.match(feature, /Scenario: User selects Canada/);
  assert.match(steps, /selectOption\(\\"CA\\"\)/);
  assert.ok(metadata.sourceOwnership.some((entry) => entry.kind === "feature" && entry.path.endsWith("country.feature")));
  assert.ok(metadata.sourceOwnership.some((entry) => entry.kind === "steps" && entry.path.endsWith("CountrySteps.java")));
});

test("force refuses manually edited drafts when ownership checksums differ", async () => {
  const repo = await createTempRepo();
  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", "country");
  const initialPlan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "adminapp",
    feature: "country",
    taskSuffix: "AdminApp",
    scenario: "User selects United States",
    recording: 'page.locator("[data-testid=\'country\']").selectOption("US");'
  });
  await applyScaffoldPlan(initialPlan);

  const featurePath = path.join(repo, "test-suite/src/test/resources/features/adminapp/country.feature");
  const manualFeature = `${await readFile(featurePath, "utf8")}\n# manual edit\n`;
  await writeFile(featurePath, manualFeature, "utf8");
  const before = await snapshotTree(repo);

  const forcePlan = await planCaseScaffold({
    repoRoot: repo,
    draftDir,
    area: "adminapp",
    feature: "country",
    taskSuffix: "AdminApp",
    scenario: "User selects Canada",
    recording: 'page.locator("[data-testid=\'country\']").selectOption("CA");',
    force: true
  });

  assert.equal(forcePlan.conflicts.find((operation) => operation.kind === "feature")?.status, "conflict");
  assert.match(forcePlan.conflicts.find((operation) => operation.kind === "feature")?.reason, /checksum differs/);
  await assert.rejects(() => applyScaffoldPlan(forcePlan), /checksum differs from generated ownership evidence/);
  assert.deepEqual(await snapshotTree(repo), before);
});

test("partial scaffold states are reused only when safe and otherwise fail unchanged", async () => {
  const directoryOnlyRepo = await createTempRepo();
  await mkdir(path.join(directoryOnlyRepo, "test-suite/src/test/resources/features/adminapp"), { recursive: true });
  await mkdir(path.join(directoryOnlyRepo, "test-suite/src/test/java/com/example/e2e/tests/steps/adminapp"), { recursive: true });
  await mkdir(path.join(directoryOnlyRepo, "test-suite/src/test/java/com/example/e2e/tests/runner/adminapp"), { recursive: true });
  const directoryOnlyPlan = await planCaseScaffold({
    repoRoot: directoryOnlyRepo,
    draftDir: path.join(directoryOnlyRepo, "test-suite/build/case-drafts/adminapp/user-profile"),
    area: "adminapp",
    feature: "user-profile",
    taskSuffix: "AdminApp",
    scenario: "User opens profile",
    recording: ""
  });
  assert.deepEqual(directoryOnlyPlan.conflicts, []);
  await applyScaffoldPlan(directoryOnlyPlan);
  assert.equal(existsSync(path.join(
    directoryOnlyRepo,
    "test-suite/src/test/java/com/example/e2e/tests/runner/adminapp/AdminAppRunCucumberTest.java"
  )), true);

  const runnerOnlyRepo = await createTempRepo();
  const runnerOnlyPath = path.join(runnerOnlyRepo, "test-suite/src/test/java/com/example/e2e/tests/runner/adminapp/AdminAppRunCucumberTest.java");
  await mkdir(path.dirname(runnerOnlyPath), { recursive: true });
  await writeFile(runnerOnlyPath, renderRunner("adminapp", "AdminAppRunCucumberTest"), "utf8");
  await assertUnsafePartialState(runnerOnlyRepo, /runner.*already exists/);

  const gradleOnlyRepo = await createTempRepo();
  await registerAdminArea(gradleOnlyRepo);
  await assertUnsafePartialState(gradleOnlyRepo, /registered runner .* is missing/);

  const featureOnlyRepo = await createTempRepo();
  const featureOnlyPath = path.join(featureOnlyRepo, "test-suite/src/test/resources/features/adminapp/user-profile.feature");
  await mkdir(path.dirname(featureOnlyPath), { recursive: true });
  await writeFile(featureOnlyPath, "Feature: manual partial\n", "utf8");
  await assertUnsafePartialState(featureOnlyRepo, /feature already exists/);

  const mismatchedGlueRepo = await createTempRepo();
  await registerAdminArea(mismatchedGlueRepo, {
    mutateBuildGradle: (contents) => contents.replace(
      /\n\s*'com\.example\.e2e\.tests\.steps\.adminapp'/,
      ""
    )
  });
  const mismatchedRunnerPath = path.join(mismatchedGlueRepo, "test-suite/src/test/java/com/example/e2e/tests/runner/adminapp/AdminAppRunCucumberTest.java");
  await mkdir(path.dirname(mismatchedRunnerPath), { recursive: true });
  await writeFile(mismatchedRunnerPath, renderRunner("adminapp", "AdminAppRunCucumberTest"), "utf8");
  await assertUnsafePartialState(mismatchedGlueRepo, /registered glue is missing com\.example\.e2e\.tests\.steps\.adminapp/);
});

test("generate CLI applies the scaffold and prints metadata-aligned output", async () => {
  const repo = await createTempRepo();
  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", "user-profile");
  await mkdir(draftDir, { recursive: true });
  await writeFile(path.join(draftDir, "recording.java"), supportedRecording, "utf8");
  await writeFile(path.join(draftDir, "metadata.json"), `${JSON.stringify({
    area: "adminapp",
    feature: "user-profile",
    scenario: "User updates profile from metadata",
    baseUrl: "https://app.example.test",
    path: "/profile",
    recording: "recording.java"
  }, null, 2)}\n`, "utf8");

  const result = spawnSync(process.execPath, [
    path.join(repoRoot, "tools/case-recorder/src/generate.mjs"),
    "--repo-root", repo,
    "--area", "adminapp",
    "--feature", "user-profile",
    "--task-suffix", "AdminApp",
    "--draft-dir", draftDir
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Generated .*user-profile\.feature/);
  assert.match(result.stdout, /Generated .*UserProfileSteps\.java/);
  assert.match(result.stdout, /Generated .*metadata\.json/);
  assert.match(result.stdout, /Next validation command: \.\/gradlew :test-suite:testAdminApp/);

  const metadata = JSON.parse(await readFile(path.join(draftDir, "metadata.json"), "utf8"));
  assert.equal(metadata.scenario, "User updates profile from metadata");
  assert.equal(metadata.resolvedUrl, "https://app.example.test/profile");
  assert.equal(metadata.terminalSummary, result.stdout.trim());
});

test("generate CLI infers path-prefixed base URLs from legacy relative-path metadata", async () => {
  const repo = await createTempRepo();
  const draftDir = path.join(repo, "test-suite", "build", "case-drafts", "adminapp", "profile-settings");
  await mkdir(draftDir, { recursive: true });
  await writeFile(path.join(draftDir, "recording.java"), `
    page.navigate("https://app.example.test/root/profile?tab=settings");
    assertThat(page).hasTitle(Pattern.compile(".*Profile.*"));
  `, "utf8");
  await writeFile(path.join(draftDir, "metadata.json"), `${JSON.stringify({
    area: "adminapp",
    feature: "profile-settings",
    scenario: "User updates profile from legacy metadata",
    url: "https://app.example.test/root/profile?tab=settings",
    path: "profile?tab=settings",
    recording: "recording.java"
  }, null, 2)}\n`, "utf8");

  const result = spawnSync(process.execPath, [
    path.join(repoRoot, "tools/case-recorder/src/generate.mjs"),
    "--repo-root", repo,
    "--area", "adminapp",
    "--feature", "profile-settings",
    "--task-suffix", "AdminApp",
    "--draft-dir", draftDir
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Resolved URL: https:\/\/app\.example\.test\/root\/profile\?tab=settings/);

  const feature = await readFile(path.join(
    repo,
    "test-suite/src/test/resources/features/adminapp/profile-settings.feature"
  ), "utf8");
  assert.match(feature, /Given the user opens the relative path "profile\?tab=settings"/);

  const metadata = JSON.parse(await readFile(path.join(draftDir, "metadata.json"), "utf8"));
  assert.equal(metadata.baseUrl, "https://app.example.test/root/");
  assert.equal(metadata.path, "profile?tab=settings");
  assert.equal(metadata.resolvedUrl, "https://app.example.test/root/profile?tab=settings");
});

async function createTempRepo() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "case-recorder-scaffold-"));
  const buildGradlePath = path.join(tempRoot, "test-suite", "build.gradle");
  await mkdir(path.dirname(buildGradlePath), { recursive: true });
  await writeFile(buildGradlePath, await readFile(sourceBuildGradle, "utf8"), "utf8");
  await stat(buildGradlePath);
  return tempRoot;
}

async function copyRegisteredRunner(repo, areaName, runnerClassName) {
  const relativeRunnerPath = path.join(
    "test-suite",
    "src",
    "test",
    "java",
    "com",
    "example",
    "e2e",
    "tests",
    "runner",
    areaName,
    `${runnerClassName}.java`
  );
  const destination = path.join(repo, relativeRunnerPath);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(repoRoot, relativeRunnerPath), destination);
}

async function registerAdminArea(repo, { mutateBuildGradle } = {}) {
  const buildGradlePath = path.join(repo, "test-suite/build.gradle");
  const buildGradle = await readFile(buildGradlePath, "utf8");
  const area = createAreaConfig({
    areaName: "adminapp",
    taskSuffix: "AdminApp",
    baseUrl: "https://app.example.test",
    explorePath: "/profile",
    testIdAttribute: "data-testid"
  });
  const updatedBuildGradle = renderUpdatedBuildGradle(buildGradle, "adminapp", area);
  await writeFile(
    buildGradlePath,
    mutateBuildGradle ? mutateBuildGradle(updatedBuildGradle) : updatedBuildGradle,
    "utf8"
  );
}

async function assertUnsafePartialState(repo, expectedReason) {
  const before = await snapshotTree(repo);
  const plan = await planCaseScaffold({
    repoRoot: repo,
    draftDir: path.join(repo, "test-suite/build/case-drafts/adminapp/user-profile"),
    area: "adminapp",
    feature: "user-profile",
    taskSuffix: "AdminApp",
    scenario: "User opens profile",
    recording: supportedRecording
  });

  assert.ok(plan.conflicts.length > 0);
  assert.match(plan.conflicts.map((operation) => operation.reason).join("\n"), expectedReason);
  await assert.rejects(() => applyScaffoldPlan(plan), expectedReason);
  assert.deepEqual(await snapshotTree(repo), before);
}

async function snapshotTree(root) {
  const files = {};

  async function walk(directory) {
    if (!existsSync(directory)) {
      return;
    }
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".git") {
        continue;
      }
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(filePath);
      } else if (entry.isFile()) {
        files[normalize(path.relative(root, filePath))] = sha256(await readFile(filePath, "utf8"));
      }
    }
  }

  await walk(root);
  return files;
}

async function checksumMap(filePaths) {
  return Object.fromEntries(await Promise.all(filePaths.map(async (filePath) => [
    normalize(filePath),
    sha256(await readFile(filePath, "utf8"))
  ])));
}

function initializeGitRepo(repo) {
  const result = spawnSync("git", ["-C", repo, "init"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function gitStatus(repo) {
  const result = spawnSync("git", ["-C", repo, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return value.split(path.sep).join("/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
