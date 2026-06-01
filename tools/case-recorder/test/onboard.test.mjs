import test from "node:test";
import assert from "node:assert/strict";
import { chmod, copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ONBOARD_HELP, runOnboardCase } from "../src/onboard.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const sourceBuildGradle = path.join(repoRoot, "test-suite", "build.gradle");
const onboardCli = path.join(repoRoot, "tools/case-recorder/src/onboard.mjs");
const shellWrapper = path.join(repoRoot, "tools/case-recorder/bin/onboard-case.sh");
const cmdWrapper = path.join(repoRoot, "tools/case-recorder/bin/onboard-case.cmd");

const supportedRecording = `
  page.navigate("https://playwright.dev/docs/intro");
  assertThat(page).hasTitle(Pattern.compile(".*Playwright.*"));
`;

test("onboarding help is available from node and wrapper entry points", async () => {
  assert.match(ONBOARD_HELP, /--area <area>/);
  assert.match(ONBOARD_HELP, /--feature <feature>/);
  assert.match(ONBOARD_HELP, /--fixture <recording.java>/);
  assert.match(ONBOARD_HELP, /--recording <recording.java>/);
  assert.match(ONBOARD_HELP, /--mode <fixture\|interactive>/);
  assert.match(ONBOARD_HELP, /--base-url <url>/);
  assert.match(ONBOARD_HELP, /--task-suffix <Suffix>/);
  assert.match(ONBOARD_HELP, /--dry-run/);
  assert.match(ONBOARD_HELP, /--force/);

  const nodeHelp = spawnSync(process.execPath, [onboardCli, "--help"], { encoding: "utf8" });
  assert.equal(nodeHelp.status, 0, nodeHelp.stderr);
  assert.match(nodeHelp.stdout, /Usage: .*onboard/);
  assert.match(nodeHelp.stdout, /Fixture mode does not launch Playwright codegen/);

  const shellHelp = spawnSync("sh", [shellWrapper, "--help"], { encoding: "utf8" });
  assert.equal(shellHelp.status, 0, shellHelp.stderr);
  assert.match(shellHelp.stdout, /--area <area>/);
  assert.match(shellHelp.stdout, /--fixture <recording.java>/);

  const cmdContents = await readFile(cmdWrapper, "utf8");
  assert.match(cmdContents, /src[\\/]onboard\.mjs/i);
  assert.match(cmdContents, /--repo-root/i);
});

test("fixture mode writes raw recording and complete scaffold without launching codegen", async () => {
  const repo = await createTempRepo();
  const fixturePath = path.join(repo, "fixture-recording.java");
  await writeFile(fixturePath, supportedRecording, "utf8");
  const draftDir = path.join(repo, "test-suite/build/case-drafts/smokeapp/landing-page");

  const result = await runOnboardCase({
    repoRoot: repo,
    draftDir,
    area: "smokeapp",
    feature: "landing-page",
    scenario: "Visitor opens the docs",
    baseUrl: "https://playwright.dev",
    path: "/docs/intro",
    taskSuffix: "SmokeApp",
    fixture: fixturePath
  }, {
    runPreflight: passingPreflight,
    recordInteractive: () => {
      throw new Error("fixture mode must not launch codegen");
    }
  });

  assert.equal(result.mode, "fixture");
  assert.equal(result.launchedCodegen, false);
  assert.match(result.output, /Fixture mode: using recording fixture/);
  assert.match(result.output, /Playwright codegen was not launched/);
  assert.match(result.output, /Next validation command: \.\/gradlew :test-suite:testSmokeApp/);

  assert.equal(await readFile(path.join(draftDir, "recording.java"), "utf8"), `${supportedRecording.trimEnd()}\n`);
  const metadata = JSON.parse(await readFile(path.join(draftDir, "metadata.json"), "utf8"));
  assert.equal(metadata.onboardingMode, "fixture");
  assert.equal(metadata.recording, "recording.java");
  assert.equal(metadata.resolvedUrl, "https://playwright.dev/docs/intro");
  assert.equal(existsSync(path.join(repo, "test-suite/src/test/resources/features/smokeapp/landing-page.feature")), true);
  assert.equal(existsSync(path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/steps/smokeapp/LandingPageSteps.java")), true);
  assert.equal(existsSync(path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/runner/smokeapp/SmokeAppRunCucumberTest.java")), true);
  assert.match(await readFile(path.join(repo, "test-suite/build.gradle"), "utf8"), /smokeapp:\s*\[/);
});

test("shell wrapper fixture run exposes the same onboarding outputs", async () => {
  const repo = await createTempRepo();
  const fixturePath = path.join(repo, "fixture-recording.java");
  await writeFile(fixturePath, supportedRecording, "utf8");

  const result = spawnSync("sh", [
    shellWrapper,
    "--repo-root", repo,
    "--area", "wrapapp",
    "--feature", "landing-page",
    "--scenario", "Visitor opens the docs",
    "--base-url", "https://playwright.dev",
    "--path", "/docs/intro",
    "--task-suffix", "WrapApp",
    "--fixture", fixturePath
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Fixture mode: using recording fixture/);
  assert.match(result.stdout, /Playwright codegen was not launched/);
  assert.match(result.stdout, /Next validation command: \.\/gradlew :test-suite:testWrapApp/);
  assert.equal(existsSync(path.join(repo, "test-suite/src/test/resources/features/wrapapp/landing-page.feature")), true);
  assert.equal(existsSync(path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/runner/wrapapp/WrapAppRunCucumberTest.java")), true);
  const metadata = JSON.parse(await readFile(path.join(
    repo,
    "test-suite/build/case-drafts/wrapapp/landing-page/metadata.json"
  ), "utf8"));
  assert.equal(metadata.onboardingMode, "fixture");
  assert.equal(metadata.taskName, "testWrapApp");
});

test("fixture dry-run reports the full plan and writes nothing", async () => {
  const repo = await createTempRepo();
  const fixturePath = path.join(repo, "fixture-recording.java");
  await writeFile(fixturePath, supportedRecording, "utf8");
  const draftDir = path.join(repo, "test-suite/build/case-drafts/dryapp/landing-page");

  const result = await runOnboardCase({
    repoRoot: repo,
    draftDir,
    area: "dryapp",
    feature: "landing-page",
    scenario: "Visitor opens the docs",
    baseUrl: "https://playwright.dev",
    path: "/docs/intro",
    taskSuffix: "DryApp",
    fixture: fixturePath,
    dryRun: true
  }, {
    runPreflight: passingPreflight
  });

  assert.equal(result.mode, "fixture");
  assert.match(result.output, /Dry-run mode: no files were written/);
  assert.match(result.output, /Would create \[create].*landing-page\.feature/);
  assert.match(result.output, /Would create \[create].*recording\.java/);
  assert.equal(existsSync(path.join(repo, "test-suite/src/test/resources/features/dryapp/landing-page.feature")), false);
  assert.equal(existsSync(path.join(draftDir, "recording.java")), false);
  assert.equal(existsSync(path.join(draftDir, "metadata.json")), false);
});

test("preflight failure stops fixture onboarding before any writes", async () => {
  const repo = await createTempRepo();
  const fixturePath = path.join(repo, "fixture-recording.java");
  await writeFile(fixturePath, supportedRecording, "utf8");
  const draftDir = path.join(repo, "test-suite/build/case-drafts/badapp/landing-page");

  await assert.rejects(
    () => runOnboardCase({
      repoRoot: repo,
      draftDir,
      area: "badapp",
      feature: "landing-page",
      scenario: "Visitor opens the docs",
      baseUrl: "https://playwright.dev",
      path: "/docs/intro",
      taskSuffix: "BadApp",
      fixture: fixturePath
    }, {
      runPreflight: failingPreflight
    }),
    /Case recorder preflight failed/
  );

  assert.equal(existsSync(path.join(repo, "test-suite/src/test/resources/features/badapp")), false);
  assert.equal(existsSync(path.join(repo, "test-suite/src/test/java/com/example/e2e/tests/runner/badapp")), false);
  assert.equal(existsSync(draftDir), false);
});

test("interactive mode delegates to codegen for the resolved URL before generation", async () => {
  const repo = await createTempRepo();
  const draftDir = path.join(repo, "test-suite/build/case-drafts/liveapp/landing-page");
  let recordedRequest;

  const result = await runOnboardCase({
    repoRoot: repo,
    draftDir,
    area: "liveapp",
    feature: "landing-page",
    scenario: "Visitor opens the docs",
    baseUrl: "https://playwright.dev",
    path: "/docs/intro",
    taskSuffix: "LiveApp",
    mode: "interactive"
  }, {
    runPreflight: passingPreflight,
    recordInteractive: async (request) => {
      recordedRequest = request;
      await mkdir(request.draftDir, { recursive: true });
      await writeFile(path.join(request.draftDir, "recording.java"), supportedRecording, "utf8");
      await writeFile(path.join(request.draftDir, "metadata.json"), `${JSON.stringify({
        area: request.area,
        feature: request.feature,
        scenario: request.scenario,
        url: request.url,
        path: request.path,
        recording: "recording.java"
      }, null, 2)}\n`, "utf8");
    }
  });

  assert.equal(result.mode, "interactive");
  assert.equal(result.launchedCodegen, true);
  assert.equal(recordedRequest.url, "https://playwright.dev/docs/intro");
  assert.match(result.output, /Interactive mode: launching Playwright codegen for https:\/\/playwright\.dev\/docs\/intro/);
  assert.match(result.output, /Close the Playwright codegen window when the flow is complete/);
  assert.equal(existsSync(path.join(repo, "test-suite/src/test/resources/features/liveapp/landing-page.feature")), true);
  assert.match(result.output, /Generated \[update].*recording\.java/);
  const metadata = JSON.parse(await readFile(path.join(draftDir, "metadata.json"), "utf8"));
  assert.equal(metadata.onboardingMode, "interactive");
  assert.equal(metadata.recording, "recording.java");
  assert.ok(metadata.generatedFiles.some((file) => file.endsWith("recording.java")));
});

test("interactive mode refuses scaffold conflicts before launching codegen or writing drafts", async () => {
  const repo = await createTempRepo();
  const existingFeaturePath = path.join(
    repo,
    "test-suite/src/test/resources/features/liveapp/landing-page.feature"
  );
  await mkdir(path.dirname(existingFeaturePath), { recursive: true });
  await writeFile(existingFeaturePath, "Feature: manually owned\n", "utf8");
  const draftDir = path.join(repo, "test-suite/build/case-drafts/liveapp/landing-page");
  let launched = false;

  await assert.rejects(
    () => runOnboardCase({
      repoRoot: repo,
      draftDir,
      area: "liveapp",
      feature: "landing-page",
      scenario: "Visitor opens the docs",
      baseUrl: "https://playwright.dev",
      path: "/docs/intro",
      taskSuffix: "LiveApp",
      mode: "interactive"
    }, {
      runPreflight: passingPreflight,
      recordInteractive: async () => {
        launched = true;
        throw new Error("interactive codegen should not launch when scaffold conflicts exist");
      }
    }),
    /Resolve scaffold conflicts before onboarding writes or interactive codegen/
  );

  assert.equal(launched, false);
  assert.equal(await readFile(existingFeaturePath, "utf8"), "Feature: manually owned\n");
  assert.equal(existsSync(path.join(draftDir, "recording.java")), false);
  assert.equal(existsSync(path.join(draftDir, "metadata.json")), false);
});

test("Gradle recorder task declarations document onboarding and legacy entry points", async () => {
  const buildGradle = await readFile(sourceBuildGradle, "utf8");
  assert.match(buildGradle, /tasks\.register\('onboardCase'\)/);
  assert.match(buildGradle, /description = 'Runs full record-first onboarding\./);
  assert.match(buildGradle, /-Pfixture\/-Precording/);
  assert.match(buildGradle, /-Pmode=fixture\|interactive/);
  assert.match(buildGradle, /tasks\.register\('caseRecorderOnboardingSmoke'\)/);
  assert.match(buildGradle, /unattended fixture smoke/);
  assert.match(buildGradle, /tasks\.register\('recordCase'\)/);
  assert.match(buildGradle, /Legacy recorder: records browser actions/);
  assert.match(buildGradle, /tasks\.register\('generateCaseFromRecording'\)/);
  assert.match(buildGradle, /Legacy generator: creates feature and step drafts/);
  assert.match(buildGradle, /tasks\.register\('generateCase'\)/);
  assert.match(buildGradle, /Legacy alias for generateCaseFromRecording/);
});

test("legacy recorder package scripts remain backward compatible", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "tools/case-recorder/package.json"), "utf8"));
  assert.equal(packageJson.scripts.doctor, "node src/doctor.mjs");
  assert.equal(packageJson.scripts["doctor:shell"], "sh bin/doctor.sh");
  assert.equal(packageJson.scripts.test, "node --test test/*.test.mjs");
  assert.equal(packageJson.scripts.record, "node src/record.mjs");
  assert.equal(packageJson.scripts.generate, "node src/generate.mjs");
  assert.equal(packageJson.scripts.onboard, "node src/onboard.mjs");
});

async function createTempRepo() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "case-recorder-onboard-"));
  const buildGradlePath = path.join(tempRoot, "test-suite", "build.gradle");
  await mkdir(path.dirname(buildGradlePath), { recursive: true });
  await copyFile(sourceBuildGradle, buildGradlePath);
  const gradlewPath = path.join(tempRoot, "gradlew");
  await copyFile(path.join(repoRoot, "gradlew"), gradlewPath);
  await chmod(gradlewPath, 0o755);
  return tempRoot;
}

function passingPreflight() {
  return {
    ok: true,
    checks: [
      { label: "Node.js", ok: true, message: "fixture node" },
      { label: "npm", ok: true, message: "fixture npm" },
      { label: "Java", ok: true, message: "fixture java" },
      { label: "Gradle wrapper", ok: true, message: "fixture gradle" }
    ]
  };
}

function failingPreflight() {
  return {
    ok: false,
    checks: [
      { label: "Node.js", ok: true, message: "fixture node" },
      { label: "npm", ok: false, message: "npm resolved to /mnt/c/node/npm; install/use the WSL npm executable instead" },
      { label: "Java", ok: true, message: "fixture java" },
      { label: "Gradle wrapper", ok: true, message: "fixture gradle" }
    ]
  };
}
