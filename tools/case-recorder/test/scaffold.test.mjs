import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
  assert.equal(plan.operations.some((operation) => operation.kind === "runner"), false);
  assert.equal(plan.operations.some((operation) => operation.kind === "gradle-registration"), false);

  const result = await applyScaffoldPlan(plan);
  assert.match(result.summary, /Reused registered area demoapp \(testDemoApp\)/);
  assert.equal(await readFile(path.join(repo, "test-suite/build.gradle"), "utf8"), originalBuildGradle);
  assert.equal(
    existsSync(path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/runner/demoapp/DemoAppRunCucumberTest.java")),
    false
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
    path: "/profile?tab=settings",
    navigationTarget: "/profile?tab=settings",
    resolvedUrl: "https://app.example.test/root/profile?tab=settings"
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

async function createTempRepo() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "case-recorder-scaffold-"));
  const buildGradlePath = path.join(tempRoot, "test-suite", "build.gradle");
  await mkdir(path.dirname(buildGradlePath), { recursive: true });
  await writeFile(buildGradlePath, await readFile(sourceBuildGradle, "utf8"), "utf8");
  await stat(buildGradlePath);
  return tempRoot;
}
