import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  generateCaseDraft,
  renderDraftPack,
  renderDraftSummary
} from "./case-draft.mjs";
import {
  createAreaConfig,
  findRegisteredArea,
  findNewAreaRegistrationConflicts,
  renderUpdatedBuildGradle
} from "./gradle-areas.mjs";
import {
  humanize,
  toPascalCase,
  validateJavaPackageSegment,
  validateSlug
} from "./names.mjs";
import { renderRunner } from "./scaffold-render.mjs";
export { formatScaffoldSummary } from "./scaffold-render.mjs";
export { applyScaffoldPlan } from "./scaffold-writer.mjs";

const DEFAULT_BASE_URL = "https://playwright.dev";
const DEFAULT_TEST_ID_ATTRIBUTE = "data-testid";

export async function planCaseScaffold(options) {
  const repoRoot = requiredText(options.repoRoot, "repoRoot");
  const draftDir = requiredText(options.draftDir, "draftDir");
  const areaName = requiredText(options.area, "area");
  const featureName = requiredText(options.feature, "feature");
  const requestedTaskSuffix = textOr(options.taskSuffix);
  const taskSuffix = textOr(requestedTaskSuffix, toPascalCase(areaName));
  const scenario = textOr(options.scenario, humanize(featureName));
  const testIdAttribute = textOr(options.testIdAttribute, DEFAULT_TEST_ID_ATTRIBUTE);
  const force = Boolean(options.force);
  const persistRecording = Boolean(options.persistRecording);
  const recordingFileName = textOr(options.recordingFileName, "recording.java");

  validateJavaPackageSegment(areaName, "area");
  validateSlug(featureName, "feature");
  validateTaskSuffix(taskSuffix);

  const target = resolveCaseTarget({
    baseUrl: textOr(options.baseUrl, DEFAULT_BASE_URL),
    path: textOr(options.path, "/")
  });
  const stepClassName = `${toPascalCase(featureName)}Steps`;
  const buildGradlePath = path.join(repoRoot, "test-suite", "build.gradle");
  const buildGradleContents = await readFile(buildGradlePath, "utf8");
  const existingArea = findRegisteredArea(buildGradleContents, areaName);
  const existingMetadata = await readJsonIfExists(path.join(draftDir, "metadata.json"));
  const area = existingArea ?? createAreaConfig({
    areaName,
    taskSuffix,
    baseUrl: target.baseUrl,
    explorePath: target.navigationTarget,
    testIdAttribute
  });
  const sourcePaths = createSourcePaths(repoRoot, areaName, featureName, stepClassName, area.runnerFqn);
  const nextValidationCommand = `./gradlew :test-suite:${area.taskName} --console=plain --no-daemon -Dheadless=true`;
  const draft = generateCaseDraft(textOr(options.recording, ""), {
    area: areaName,
    feature: featureName,
    scenario,
    baseUrl: target.baseUrl,
    path: target.navigationTarget,
    resolvedUrl: target.resolvedUrl
  });

  const generatedFiles = [
    sourcePaths.featurePath,
    sourcePaths.stepsPath,
    ...(existingArea ? [] : [sourcePaths.runnerPath, buildGradlePath]),
    ...(persistRecording ? [path.join(draftDir, recordingFileName)] : []),
    path.join(draftDir, "metadata.json"),
    path.join(draftDir, "case-draft.json"),
    path.join(draftDir, "draft-summary.md")
  ].map((filePath) => normalizePath(path.relative(repoRoot, filePath)));
  const reviewWork = createReviewWork(draft, nextValidationCommand);
  const enrichedDraft = {
    ...draft,
    baseUrl: target.baseUrl,
    path: target.navigationTarget,
    resolvedUrl: target.resolvedUrl,
    generatedFiles,
    reviewWork,
    nextValidationCommand
  };

  const operations = [
    await createFileOperation({
      kind: "feature",
      filePath: sourcePaths.featurePath,
      contents: enrichedDraft.files.feature,
      force,
      repoRoot,
      ownershipMetadata: existingMetadata
    }),
    await createFileOperation({
      kind: "steps",
      filePath: sourcePaths.stepsPath,
      contents: enrichedDraft.files.steps,
      force,
      repoRoot,
      ownershipMetadata: existingMetadata
    })
  ];

  if (!existingArea) {
    operations.push(await createFileOperation({
      kind: "runner",
      filePath: sourcePaths.runnerPath,
      contents: renderRunner(areaName, area.runnerClassName),
      force: false,
      repoRoot,
      ownershipMetadata: existingMetadata
    }));
    const registrationConflicts = findNewAreaRegistrationConflicts(buildGradleContents, areaName, area);
    operations.push(registrationConflicts.length > 0
      ? createConflictOperation({
        kind: "gradle-registration",
        filePath: buildGradlePath,
        contents: buildGradleContents,
        reason: registrationConflicts.join("; ")
      })
      : {
        kind: "gradle-registration",
        filePath: buildGradlePath,
        contents: renderUpdatedBuildGradle(buildGradleContents, areaName, area),
        status: "update",
        source: true
      });
  } else {
    operations.push(...await createExistingAreaOperations({
      repoRoot,
      areaName,
      area,
      requestedTaskSuffix,
      sourcePaths,
      buildGradlePath,
      buildGradleContents
    }));
  }

  const sourceOwnership = createSourceOwnership(operations, repoRoot);
  const metadata = {
    generatedBy: "tools/case-recorder",
    schemaVersion: 2,
    area: areaName,
    feature: featureName,
    scenario,
    baseUrl: target.baseUrl,
    path: target.navigationTarget,
    resolvedUrl: target.resolvedUrl,
    recording: recordingFileName,
    onboardingMode: textOr(options.onboardingMode),
    recordingSource: textOr(options.recordingSource),
    taskName: area.taskName,
    taskSuffix: area.taskSuffix,
    runnerClassName: area.runnerClassName,
    runnerFqn: area.runnerFqn,
    stepClassName,
    areaReused: Boolean(existingArea),
    generatedFiles,
    sourceOwnership,
    steps: draft.steps,
    supportedActions: draft.actionInventory.filter((action) => action.supported).length,
    unsupportedActions: draft.unsupportedActions,
    reviewWork,
    nextValidationCommand
  };

  if (persistRecording) {
    operations.push(
      createDraftOperation({
        kind: "recording",
        filePath: path.join(draftDir, recordingFileName),
        contents: options.recording ?? ""
      })
    );
  }

  operations.push(
    createDraftOperation({
      kind: "metadata",
      filePath: path.join(draftDir, "metadata.json"),
      contents: JSON.stringify(metadata, null, 2)
    }),
    createDraftOperation({
      kind: "case-draft",
      filePath: path.join(draftDir, "case-draft.json"),
      contents: renderDraftPack(enrichedDraft)
    }),
    createDraftOperation({
      kind: "draft-summary",
      filePath: path.join(draftDir, "draft-summary.md"),
      contents: renderDraftSummary(enrichedDraft)
    })
  );

  return {
    repoRoot,
    draftDir,
    area,
    feature: featureName,
    scenario,
    stepClassName,
    target,
    sourcePaths,
    draft: enrichedDraft,
    metadata,
    operations,
    conflicts: operations.filter((operation) => operation.status === "conflict"),
    nextValidationCommand
  };
}

export function resolveCaseTarget({ baseUrl = DEFAULT_BASE_URL, path: requestedPath = "/" } = {}) {
  const normalizedBaseUrl = requiredText(baseUrl, "baseUrl");
  const rawPath = textOr(requestedPath, "/");

  if (/^https?:\/\//i.test(rawPath)) {
    return {
      baseUrl: normalizedBaseUrl,
      path: rawPath,
      navigationTarget: rawPath,
      resolvedUrl: rawPath
    };
  }

  const navigationTarget = rawPath === "/" ? "/" : (rawPath.startsWith("/") ? rawPath : `/${rawPath}`);
  return {
    baseUrl: normalizedBaseUrl,
    path: navigationTarget,
    navigationTarget,
    resolvedUrl: navigationTarget === "/"
      ? normalizedBaseUrl
      : `${normalizedBaseUrl.replace(/\/$/, "")}${navigationTarget}`
  };
}

function createSourcePaths(repoRoot, areaName, featureName, stepClassName, runnerFqn) {
  return {
    featurePath: path.join(
      repoRoot,
      "test-suite",
      "src",
      "test",
      "resources",
      "features",
      areaName,
      `${featureName}.feature`
    ),
    stepsPath: path.join(
      repoRoot,
      "test-suite",
      "src",
      "test",
      "java",
      "com",
      "example",
      "e2e",
      "tests",
      "steps",
      areaName,
      `${stepClassName}.java`
    ),
    runnerPath: path.join(
      repoRoot,
      "test-suite",
      "src",
      "test",
      "java",
      ...runnerFqn.split(".")
    ) + ".java"
  };
}

async function createExistingAreaOperations({
  repoRoot,
  areaName,
  area,
  requestedTaskSuffix,
  sourcePaths,
  buildGradlePath,
  buildGradleContents
}) {
  const operations = [];
  const gradleConflicts = validateExistingAreaConfig(areaName, area, requestedTaskSuffix);
  operations.push(gradleConflicts.length > 0
    ? createConflictOperation({
      kind: "gradle-registration",
      filePath: buildGradlePath,
      contents: buildGradleContents,
      reason: gradleConflicts.join("; ")
    })
    : createSkipOperation({
      kind: "gradle-registration",
      filePath: buildGradlePath,
      contents: buildGradleContents,
      reason: `registered area ${areaName} already provides Gradle task ${area.taskName}`
    }));

  const runnerValidation = await validateExistingRunner({
    repoRoot,
    areaName,
    area,
    runnerPath: sourcePaths.runnerPath
  });
  operations.push(runnerValidation.ok
    ? createSkipOperation({
      kind: "runner",
      filePath: sourcePaths.runnerPath,
      contents: runnerValidation.contents,
      reason: `registered runner ${area.runnerFqn} already selects features/${areaName}`
    })
    : createConflictOperation({
      kind: "runner",
      filePath: sourcePaths.runnerPath,
      contents: runnerValidation.contents ?? "",
      reason: runnerValidation.reason
    }));

  return operations;
}

function validateExistingAreaConfig(areaName, area, requestedTaskSuffix) {
  const conflicts = [];
  if (requestedTaskSuffix && requestedTaskSuffix !== area.taskSuffix) {
    conflicts.push(`requested task suffix '${requestedTaskSuffix}' does not match registered suffix '${area.taskSuffix}'`);
  }

  const expectedRunnerPrefix = `com.example.e2e.tests.runner.${areaName}.`;
  if (areaName !== "common" && !area.runnerFqn.startsWith(expectedRunnerPrefix)) {
    conflicts.push(`runnerClassName '${area.runnerFqn}' must stay under '${expectedRunnerPrefix}' for this area`);
  }

  const requiredGlue = [
    "com.example.e2e.core.hooks",
    "com.example.e2e.tests.steps.common"
  ];
  if (areaName !== "common") {
    requiredGlue.push(`com.example.e2e.tests.steps.${areaName}`);
  }
  const missingGlue = requiredGlue.filter((glue) => !area.glue.includes(glue));
  if (missingGlue.length > 0) {
    conflicts.push(`registered glue is missing ${missingGlue.join(", ")}`);
  }

  if (area.parallelEnabled !== false) {
    conflicts.push("registered area must keep parallelEnabled: false for generated draft onboarding");
  }
  if (area.parallelism !== 1) {
    conflicts.push("registered area must keep parallelism: 1 for generated draft onboarding");
  }

  return conflicts;
}

async function validateExistingRunner({ repoRoot, areaName, area, runnerPath }) {
  if (!area.runnerFqn.startsWith("com.example.e2e.tests.runner.")) {
    return {
      ok: false,
      reason: `runnerClassName '${area.runnerFqn}' is outside com.example.e2e.tests.runner and requires a manual merge`
    };
  }

  if (!existsSync(runnerPath)) {
    return {
      ok: false,
      reason: `registered runner '${area.runnerFqn}' is missing at ${normalizePath(path.relative(repoRoot, runnerPath))}`
    };
  }

  const contents = await readFile(runnerPath, "utf8");
  const packageName = area.runnerFqn.split(".").slice(0, -1).join(".");
  const runnerConflicts = [];
  if (!contents.includes(`package ${packageName};`)) {
    runnerConflicts.push(`runner package must be '${packageName}'`);
  }
  if (!contents.includes(`public class ${area.runnerClassName}`)) {
    runnerConflicts.push(`runner class must be '${area.runnerClassName}'`);
  }
  if (!contents.includes(`@SelectClasspathResource("features/${areaName}")`)) {
    runnerConflicts.push(`runner must select only features/${areaName}`);
  }

  return runnerConflicts.length > 0
    ? {
      ok: false,
      contents,
      reason: runnerConflicts.join("; ")
    }
    : {
      ok: true,
      contents
    };
}

async function createFileOperation({ kind, filePath, contents, force, repoRoot, ownershipMetadata }) {
  const exists = existsSync(filePath);
  let status = "create";
  let reason;
  if (exists && force && (kind === "feature" || kind === "steps")) {
    const ownership = await verifyGeneratedOwnership({
      kind,
      filePath,
      repoRoot,
      ownershipMetadata
    });
    if (ownership.ok) {
      status = "overwrite";
    } else {
      status = "conflict";
      reason = ownership.reason;
    }
  } else if (exists) {
    status = "conflict";
    reason = `${kind} already exists and default onboarding never overwrites source files`;
  }

  return {
    kind,
    filePath,
    contents,
    status,
    reason,
    guidance: status === "conflict" ? manualMergeGuidance(kind) : undefined,
    source: true
  };
}

async function verifyGeneratedOwnership({ kind, filePath, repoRoot, ownershipMetadata }) {
  const relativePath = normalizePath(path.relative(repoRoot, filePath));
  const ownership = ownershipMetadata?.sourceOwnership?.find((entry) =>
    entry.kind === kind && entry.path === relativePath
  );

  if (!ownership) {
    return {
      ok: false,
      reason: `force refused for ${relativePath}: missing generated ownership evidence in metadata.json`
    };
  }

  const currentHash = sha256(await readFile(filePath, "utf8"));
  if (ownership.sha256 !== currentHash) {
    return {
      ok: false,
      reason: `force refused for ${relativePath}: checksum differs from generated ownership evidence`
    };
  }

  return { ok: true };
}

function createSourceOwnership(operations, repoRoot) {
  return operations
    .filter((operation) =>
      operation.source &&
      ["feature", "steps", "runner"].includes(operation.kind) &&
      ["create", "overwrite"].includes(operation.status)
    )
    .map((operation) => ({
      kind: operation.kind,
      path: normalizePath(path.relative(repoRoot, operation.filePath)),
      sha256: sha256(contentsForDisk(operation.contents))
    }));
}

function createConflictOperation({ kind, filePath, contents, reason }) {
  return {
    kind,
    filePath,
    contents,
    status: "conflict",
    reason,
    guidance: manualMergeGuidance(kind),
    source: true
  };
}

function createSkipOperation({ kind, filePath, contents, reason }) {
  return {
    kind,
    filePath,
    contents,
    status: "skip",
    reason,
    source: true
  };
}

function createDraftOperation({ kind, filePath, contents }) {
  return {
    kind,
    filePath,
    contents,
    status: existsSync(filePath) ? "update" : "create",
    source: false
  };
}

function createReviewWork(draft, nextValidationCommand) {
  const work = [
    "Review the generated @draft scenario language before promotion."
  ];
  if (draft.unsupportedActions.length > 0) {
    work.push(`Implement ${draft.unsupportedActions.length} unsupported generated action(s) in area-specific steps.`);
  }
  work.push(`Run ${nextValidationCommand} after reviewing selectors and assertions.`);
  return work;
}

function validateTaskSuffix(value) {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(value)) {
    throw new Error(`task suffix must match /^[A-Z][A-Za-z0-9]*$/: ${value}`);
  }
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

async function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function manualMergeGuidance(kind) {
  if (kind === "gradle-registration") {
    return "Manual merge required: reconcile cucumberAreas before rerunning onboarding.";
  }
  if (kind === "runner") {
    return "Manual merge required: reconcile the area runner before rerunning onboarding.";
  }
  return "Manual merge required: move, delete, or intentionally regenerate the draft with valid generated ownership evidence.";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function contentsForDisk(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
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
