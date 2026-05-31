import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { booleanOption, optionalOption, parseArgs, requireOption } from "./args.mjs";
import { applyScaffoldPlan, planCaseScaffold } from "./scaffold.mjs";
import { validateJavaPackageSegment, validateSlug } from "./names.mjs";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = requireOption(options, "repo-root");
  const draftDir = requireOption(options, "draft-dir");
  const area = requireOption(options, "area");
  const feature = requireOption(options, "feature");
  const force = booleanOption(options, "force");
  const dryRun = booleanOption(options, "dry-run");

  validateJavaPackageSegment(area, "area");
  validateSlug(feature, "feature");

  const metadata = await readMetadata(draftDir);
  const scenario = optionalOption(options, "scenario", metadata.scenario);
  const pathInput = optionalOption(options, "path", metadata.path ?? "/");
  const baseUrl = optionalOption(
    options,
    "base-url",
    metadata.baseUrl ?? inferBaseUrl(metadata.url, pathInput)
  );
  const taskSuffix = optionalOption(options, "task-suffix", metadata.taskSuffix);
  const testIdAttribute = optionalOption(options, "test-id-attribute", metadata.testIdAttribute);
  const recordingPath = safeDraftPath(draftDir, metadata.recording ?? "recording.java");
  const recording = await readFile(recordingPath, "utf8");

  const plan = await planCaseScaffold({
    repoRoot,
    draftDir,
    area,
    feature,
    scenario,
    baseUrl,
    path: pathInput,
    taskSuffix,
    testIdAttribute,
    recording,
    force
  });

  const result = await applyScaffoldPlan(plan, { dryRun });
  process.stdout.write(result.summary);
  if (dryRun && plan.conflicts.length > 0) {
    process.exitCode = 1;
  }
}

async function readMetadata(draftDir) {
  const metadataPath = path.join(draftDir, "metadata.json");
  if (!existsSync(metadataPath)) {
    return {};
  }
  return JSON.parse(await readFile(metadataPath, "utf8"));
}

function safeDraftPath(draftDir, recordingName) {
  const resolvedDraftDir = path.resolve(draftDir);
  const resolvedRecordingPath = path.resolve(resolvedDraftDir, recordingName);
  if (resolvedRecordingPath !== resolvedDraftDir && !resolvedRecordingPath.startsWith(`${resolvedDraftDir}${path.sep}`)) {
    throw new Error(`Recording path must stay inside draft dir: ${recordingName}`);
  }
  return resolvedRecordingPath;
}

function inferBaseUrl(url, requestedPath) {
  if (typeof url !== "string" || url.trim().length === 0) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(url);
    const normalizedPath = typeof requestedPath === "string" && requestedPath.startsWith("/")
      ? requestedPath
      : null;
    if (normalizedPath && `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` === normalizedPath) {
      return parsedUrl.origin;
    }
    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch {
    return undefined;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
