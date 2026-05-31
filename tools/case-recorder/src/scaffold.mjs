import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  generateCaseDraft,
  renderDraftPack,
  renderDraftSummary
} from "./case-draft.mjs";
import {
  createAreaConfig,
  findRegisteredArea,
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
  const taskSuffix = textOr(options.taskSuffix, toPascalCase(areaName));
  const scenario = textOr(options.scenario, humanize(featureName));
  const testIdAttribute = textOr(options.testIdAttribute, DEFAULT_TEST_ID_ATTRIBUTE);
  const force = Boolean(options.force);

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
  const area = existingArea ?? createAreaConfig({
    areaName,
    taskSuffix,
    baseUrl: target.baseUrl,
    explorePath: target.navigationTarget,
    testIdAttribute
  });
  const sourcePaths = createSourcePaths(repoRoot, areaName, featureName, stepClassName, area.runnerClassName);
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
    createFileOperation({
      kind: "feature",
      filePath: sourcePaths.featurePath,
      contents: enrichedDraft.files.feature,
      force
    }),
    createFileOperation({
      kind: "steps",
      filePath: sourcePaths.stepsPath,
      contents: enrichedDraft.files.steps,
      force
    })
  ];

  if (!existingArea) {
    operations.push(createFileOperation({
      kind: "runner",
      filePath: sourcePaths.runnerPath,
      contents: renderRunner(areaName, area.runnerClassName),
      force: false
    }));
    operations.push({
      kind: "gradle-registration",
      filePath: buildGradlePath,
      contents: renderUpdatedBuildGradle(buildGradleContents, areaName, area),
      status: "update",
      source: true
    });
  }

  const metadata = {
    area: areaName,
    feature: featureName,
    scenario,
    baseUrl: target.baseUrl,
    path: target.navigationTarget,
    resolvedUrl: target.resolvedUrl,
    taskName: area.taskName,
    taskSuffix: area.taskSuffix,
    runnerClassName: area.runnerClassName,
    runnerFqn: area.runnerFqn,
    stepClassName,
    areaReused: Boolean(existingArea),
    generatedFiles,
    steps: draft.steps,
    supportedActions: draft.actionInventory.filter((action) => action.supported).length,
    unsupportedActions: draft.unsupportedActions,
    reviewWork,
    nextValidationCommand
  };

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

function createSourcePaths(repoRoot, areaName, featureName, stepClassName, runnerClassName) {
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
      "com",
      "example",
      "e2e",
      "tests",
      "runner",
      areaName,
      `${runnerClassName}.java`
    )
  };
}

function createFileOperation({ kind, filePath, contents, force }) {
  const exists = existsSync(filePath);
  let status = "create";
  if (exists && force && (kind === "feature" || kind === "steps")) {
    status = "overwrite";
  } else if (exists) {
    status = "conflict";
  }

  return {
    kind,
    filePath,
    contents,
    status,
    source: true
  };
}

function createDraftOperation({ kind, filePath, contents }) {
  return {
    kind,
    filePath,
    contents,
    status: existsSync(filePath) ? "overwrite" : "create",
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
