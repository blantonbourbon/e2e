import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { booleanOption, optionalOption, parseArgs, requireOption } from "./args.mjs";
import { formatPreflightResult, runPreflight as defaultRunPreflight } from "./preflight.mjs";
import { applyScaffoldPlan, formatScaffoldSummary, planCaseScaffold, resolveCaseTarget } from "./scaffold.mjs";

const DEFAULT_PLAYWRIGHT_VERSION = "1.52.0";
const DEFAULT_TEST_ID_ATTRIBUTE = "data-testid";
const DEFAULT_BASE_URL = "https://playwright.dev";
const RECORDING_FILE = "recording.java";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, "../../..");
const recordCli = path.join(scriptDir, "record.mjs");

export const ONBOARD_HELP = `Usage: case-recorder onboard --area <area> --feature <feature> [options]

Runs the complete record-first onboarding flow:
  1. Run recorder preflight checks before any writes.
  2. Use fixture mode for unattended generation or interactive mode for Playwright codegen.
  3. Generate/reuse the area scaffold, feature, steps, runner, Gradle registration, and draft metadata.

Required:
  --area <area>                      Java package-safe area name, e.g. adminapp.
  --feature <feature>                Kebab-case feature slug, e.g. user-profile.

Common options:
  --scenario <name>                  Scenario name. Defaults to a humanized feature name.
  --path <path-or-url>               Relative path or absolute URL to record/open. Defaults to /.
  --base-url <url>                   Base URL for relative paths. Gradle equivalent: -Dbase.url=<url>.
  --task-suffix <Suffix>             Gradle task suffix for new areas, e.g. AdminApp -> testAdminApp.
  --fixture <recording.java>         Java Playwright recording fixture for unattended mode.
  --recording <recording.java>       Alias for --fixture.
  --mode <fixture|interactive>       Defaults to fixture when --fixture/--recording is present; otherwise interactive.
  --dry-run                          Print the full no-write plan. Does not launch Playwright codegen.
  --force                            Refresh generated-owned feature/step drafts only when ownership evidence matches.
  --test-id-attribute <attribute>    Passed to interactive codegen and new area explore defaults. Defaults to data-testid.
  --repo-root <path>                 Repository root. Defaults to the current checkout.
  --draft-dir <path>                 Draft output directory. Defaults to test-suite/build/case-drafts/<area>/<feature>.
  --playwright-version <version>     npm playwright package used for interactive codegen.
  --help, -h                         Show this help.

Modes:
  Fixture mode does not launch Playwright codegen and is intended for unattended validation.
  Interactive mode launches Playwright codegen for the resolved URL, writes recording.java/metadata.json,
  then tells the user to close the codegen window before generation continues.
`;

export async function runOnboardCase(input, dependencies = {}) {
  const repoRoot = path.resolve(requiredText(input.repoRoot, "repoRoot"));
  const area = requiredText(input.area, "area");
  const feature = requiredText(input.feature, "feature");
  const scenario = textOr(input.scenario);
  const requestedPath = textOr(input.path, "/");
  const baseUrl = textOr(input.baseUrl, DEFAULT_BASE_URL);
  const draftDir = path.resolve(textOr(
    input.draftDir,
    path.join(repoRoot, "test-suite", "build", "case-drafts", area, feature)
  ));
  const taskSuffix = textOr(input.taskSuffix);
  const testIdAttribute = textOr(input.testIdAttribute, DEFAULT_TEST_ID_ATTRIBUTE);
  const playwrightVersion = textOr(input.playwrightVersion, DEFAULT_PLAYWRIGHT_VERSION);
  const force = Boolean(input.force);
  const dryRun = Boolean(input.dryRun);
  const fixtureInput = textOr(input.fixture, textOr(input.recording));
  const mode = resolveMode(input.mode, fixtureInput);
  const target = resolveCaseTarget({ baseUrl, path: requestedPath });
  const runPreflight = dependencies.runPreflight ?? defaultRunPreflight;
  const recordInteractive = dependencies.recordInteractive ?? defaultRecordInteractive;
  const output = [];

  const emit = (text = "") => {
    const normalized = text.endsWith("\n") ? text : `${text}\n`;
    output.push(normalized);
    dependencies.stdout?.write(normalized);
  };

  const preflight = runPreflight({ repoRoot });
  emit(formatPreflightResult(preflight).trimEnd());
  if (!preflight.ok) {
    throw new Error("Case recorder preflight failed; fix the failed checks before onboarding.");
  }

  if (!dryRun) {
    const precheckPlan = await planCaseScaffold({
      repoRoot,
      draftDir,
      area,
      feature,
      scenario,
      baseUrl: target.baseUrl,
      path: target.navigationTarget,
      taskSuffix,
      testIdAttribute,
      recording: "",
      force,
      persistRecording: true,
      recordingFileName: RECORDING_FILE,
      onboardingMode: mode,
      recordingSource: mode === "interactive"
        ? path.join(draftDir, RECORDING_FILE)
        : fixtureInput
    });
    if (precheckPlan.conflicts.length > 0) {
      emit("Scaffold preflight detected conflicts before recording or codegen.");
      emit(formatScaffoldSummary(precheckPlan, { dryRun: true }).trimEnd());
      throw new Error("Resolve scaffold conflicts before onboarding writes or interactive codegen.");
    }
  }

  let recording = "";
  let launchedCodegen = false;
  let recordingSource;

  if (dryRun) {
    emit("Dry-run mode: no files were written.");
  }

  if (mode === "fixture") {
    const fixturePath = path.resolve(repoRoot, requiredText(fixtureInput, "fixture"));
    recordingSource = fixturePath;
    recording = await readFile(fixturePath, "utf8");
    emit(`Fixture mode: using recording fixture ${fixturePath}`);
    emit("Playwright codegen was not launched.");
  } else {
    recordingSource = path.join(draftDir, RECORDING_FILE);
    if (dryRun) {
      emit(`Interactive dry-run: would launch Playwright codegen for ${target.resolvedUrl}.`);
      emit("Playwright codegen was not launched.");
    } else {
      emit(`Interactive mode: launching Playwright codegen for ${target.resolvedUrl}`);
      emit("Close the Playwright codegen window when the flow is complete.");
      launchedCodegen = true;
      await recordInteractive({
        repoRoot,
        area,
        feature,
        scenario,
        path: target.navigationTarget,
        url: target.resolvedUrl,
        draftDir,
        playwrightVersion,
        testIdAttribute,
        force
      });
      recording = await readRecordingFromDraft(draftDir);
    }
  }

  const plan = await planCaseScaffold({
    repoRoot,
    draftDir,
    area,
    feature,
    scenario,
    baseUrl: target.baseUrl,
    path: target.navigationTarget,
    taskSuffix,
    testIdAttribute,
    recording,
    force,
    persistRecording: true,
    recordingFileName: RECORDING_FILE,
    onboardingMode: mode,
    recordingSource
  });
  const result = await applyScaffoldPlan(plan, { dryRun });
  emit(result.summary.trimEnd());

  return {
    mode,
    launchedCodegen,
    plan,
    written: result.written,
    output: output.join("")
  };
}

function resolveMode(requestedMode, fixtureInput) {
  const mode = textOr(requestedMode, fixtureInput ? "fixture" : "interactive");
  if (mode !== "fixture" && mode !== "interactive") {
    throw new Error(`mode must be fixture or interactive: ${mode}`);
  }
  if (mode === "fixture" && !fixtureInput) {
    throw new Error("Fixture mode requires --fixture or --recording.");
  }
  if (mode === "interactive" && fixtureInput) {
    throw new Error("Interactive mode cannot be combined with --fixture/--recording.");
  }
  return mode;
}

async function readRecordingFromDraft(draftDir) {
  const recordingPath = path.join(draftDir, RECORDING_FILE);
  if (!existsSync(recordingPath)) {
    throw new Error(`Interactive recording did not produce ${recordingPath}`);
  }
  return readFile(recordingPath, "utf8");
}

async function defaultRecordInteractive(request) {
  const args = [
    recordCli,
    "--area", request.area,
    "--feature", request.feature,
    "--scenario", textOr(request.scenario, request.feature),
    "--path", request.path,
    "--url", request.url,
    "--draft-dir", request.draftDir,
    "--playwright-version", request.playwrightVersion,
    "--test-id-attribute", request.testIdAttribute
  ];
  if (request.force) {
    args.push("--force");
  }

  const result = spawnSync(process.execPath, args, {
    cwd: request.repoRoot,
    stdio: "inherit",
    env: process.env
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Interactive recorder exited with status ${result.status ?? 1}`);
  }
}

function optionsFromCli(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    return { help: true };
  }

  const repoRoot = path.resolve(optionalOption(options, "repo-root", defaultRepoRoot));
  const area = requireOption(options, "area");
  const feature = requireOption(options, "feature");
  const draftDir = optionalOption(
    options,
    "draft-dir",
    path.join(repoRoot, "test-suite", "build", "case-drafts", area, feature)
  );
  const baseUrl = optionalOption(options, "base-url", optionalOption(options, "base.url", DEFAULT_BASE_URL));
  const fixture = optionalOption(options, "fixture", optionalOption(options, "recording"));

  return {
    repoRoot,
    draftDir,
    area,
    feature,
    scenario: optionalOption(options, "scenario"),
    path: optionalOption(options, "path", "/"),
    baseUrl,
    taskSuffix: optionalOption(options, "task-suffix", optionalOption(options, "taskSuffix")),
    fixture,
    recording: optionalOption(options, "recording"),
    mode: optionalOption(options, "mode"),
    dryRun: booleanOption(options, "dry-run") || booleanOption(options, "dryRun"),
    force: booleanOption(options, "force"),
    testIdAttribute: optionalOption(options, "test-id-attribute", optionalOption(options, "testIdAttribute")),
    playwrightVersion: optionalOption(options, "playwright-version", DEFAULT_PLAYWRIGHT_VERSION)
  };
}

async function main() {
  const options = optionsFromCli(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(ONBOARD_HELP);
    return;
  }

  await runOnboardCase(options, { stdout: process.stdout });
}

function requiredText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required ${label}`);
  }
  return value.trim();
}

function textOr(value, fallback = undefined) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
