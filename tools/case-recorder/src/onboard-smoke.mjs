import { chmod, cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { optionalOption, booleanOption, parseArgs } from "./args.mjs";

const smokeRecording = `
  page.navigate("https://playwright.dev/");
  assertThat(page).hasTitle(Pattern.compile(".*Playwright.*"));
`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceRepoRoot = path.resolve(optionalOption(options, "repo-root", path.resolve(".")));
  const keepWorkspace = booleanOption(options, "keep-workspace");
  const executeArea = !booleanOption(options, "skip-area-execution");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "case-recorder-onboard-smoke-"));
  const workspace = path.join(tempRoot, "repo");

  try {
    await copyWorkspace(sourceRepoRoot, workspace);
    const fixturePath = path.join(tempRoot, "fixture-recording.java");
    await writeFile(fixturePath, `${smokeRecording.trimEnd()}\n`, "utf8");
    const gradlew = path.join(workspace, process.platform === "win32" ? "gradlew.bat" : "gradlew");
    if (process.platform !== "win32") {
      await chmod(gradlew, 0o755);
    }

    run(gradlew, [
      "-p", workspace,
      ":test-suite:onboardCase",
      "--console=plain",
      "--no-daemon",
      "-Parea=smokeapp",
      "-Pfeature=landing-page",
      "-Pscenario=Visitor opens the Playwright home page",
      "-Ppath=/",
      "-PtaskSuffix=SmokeApp",
      `-Pfixture=${fixturePath}`,
      "-Dbase.url=https://playwright.dev"
    ]);

    const tasks = run(gradlew, [
      "-p", workspace,
      ":test-suite:tasks",
      "--all",
      "--console=plain",
      "--no-daemon"
    ]);
    assertIncludes(tasks.stdout, "testSmokeApp", "Gradle task discovery should include testSmokeApp");
    assertIncludes(tasks.stdout, "allureReportSmokeApp", "Gradle task discovery should include SmokeApp Allure aliases");

    const dryRun = run(gradlew, [
      "-p", workspace,
      ":test-suite:testAllApps",
      "--dry-run",
      "--console=plain",
      "--no-daemon"
    ]);
    assertIncludes(dryRun.stdout, ":test-suite:testSmokeApp SKIPPED", "testAllApps dry-run should include testSmokeApp");

    run(gradlew, [
      "-p", workspace,
      ":core:compileJava",
      ":test-suite:testClasses",
      "--console=plain",
      "--no-daemon"
    ]);

    if (executeArea) {
      run(gradlew, [
        "-p", workspace,
        ":test-suite:testSmokeApp",
        "--console=plain",
        "--no-daemon",
        "-Dheadless=true"
      ]);
    }

    console.log("Recorder onboarding fixture smoke completed successfully in a disposable workspace.");
    console.log(`Workspace: ${workspace}`);
    console.log("Validated Gradle :test-suite:onboardCase, testSmokeApp discovery, testAllApps dry-run, testClasses, and generated area execution.");
  } finally {
    if (keepWorkspace) {
      console.log(`Keeping smoke workspace for inspection: ${workspace}`);
    } else if (existsSync(tempRoot)) {
      await rm(tempRoot, { recursive: true, force: true });
      console.log("Removed disposable recorder onboarding smoke workspace.");
    }
  }
}

async function copyWorkspace(sourceRepoRoot, workspace) {
  await cp(sourceRepoRoot, workspace, {
    recursive: true,
    dereference: false,
    filter: (source) => {
      const relativePath = path.relative(sourceRepoRoot, source).split(path.sep).join("/");
      if (relativePath.length === 0) {
        return true;
      }
      return !relativePath.split("/").some((part) =>
        part === ".git" ||
        part === ".gradle" ||
        part === "build" ||
        part === "node_modules"
      );
    }
  });
}

function run(command, args) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: process.env
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed with exit ${result.status}: ${[command, ...args].join(" ")}`);
  }
  return result;
}

function assertIncludes(value, expected, message) {
  if (!value.includes(expected)) {
    throw new Error(`${message}; missing ${JSON.stringify(expected)}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
