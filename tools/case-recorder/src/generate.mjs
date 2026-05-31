import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { booleanOption, optionalOption, parseArgs, requireOption } from "./args.mjs";
import { generateCaseDraft } from "./case-draft.mjs";
import { toPascalCase, validateJavaPackageSegment, validateSlug } from "./names.mjs";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = requireOption(options, "repo-root");
  const draftDir = requireOption(options, "draft-dir");
  const area = requireOption(options, "area");
  const feature = requireOption(options, "feature");
  const force = booleanOption(options, "force");

  validateJavaPackageSegment(area, "area");
  validateSlug(feature, "feature");

  const metadata = await readMetadata(draftDir);
  const scenario = optionalOption(options, "scenario", metadata.scenario);
  const baseUrl = optionalOption(options, "base-url", metadata.baseUrl);
  const recordingPath = path.join(draftDir, metadata.recording ?? "recording.java");
  const draftPackPath = path.join(draftDir, "case-draft.json");
  const draftSummaryPath = path.join(draftDir, "draft-summary.md");
  const recording = await readFile(recordingPath, "utf8");
  const draft = generateCaseDraft(recording, {
    area,
    feature,
    scenario,
    baseUrl,
    path: metadata.path ?? "/"
  });

  const featurePath = path.join(
    repoRoot,
    "test-suite",
    "src",
    "test",
    "resources",
    "features",
    area,
    `${feature}.feature`
  );
  const stepsPath = path.join(
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
    area,
    `${toPascalCase(feature)}Steps.java`
  );

  guardWritable(featurePath, force);
  guardWritable(stepsPath, force);

  await mkdir(path.dirname(featurePath), { recursive: true });
  await mkdir(path.dirname(stepsPath), { recursive: true });
  await mkdir(draftDir, { recursive: true });
  await writeFile(featurePath, draft.files.feature, "utf8");
  await writeFile(stepsPath, draft.files.steps, "utf8");
  await writeFile(draftPackPath, draft.files.draftPack, "utf8");
  await writeFile(draftSummaryPath, draft.files.summary, "utf8");

  console.log(`Generated ${featurePath}`);
  console.log(`Generated ${stepsPath}`);
  console.log(`Generated ${draftPackPath}`);
  console.log(`Generated ${draftSummaryPath}`);
  if (draft.unsupportedActions.length > 0) {
    console.log(`${draft.unsupportedActions.length} recorded action(s) need manual step implementation.`);
  }
}

async function readMetadata(draftDir) {
  const metadataPath = path.join(draftDir, "metadata.json");
  if (!existsSync(metadataPath)) {
    return {};
  }
  return JSON.parse(await readFile(metadataPath, "utf8"));
}

function guardWritable(filePath, force) {
  if (existsSync(filePath) && !force) {
    throw new Error(`Refusing to overwrite existing file without --force: ${filePath}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
