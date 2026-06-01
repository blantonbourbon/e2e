import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { booleanOption, optionalOption, parseArgs, requireOption } from "./args.mjs";
import { validateJavaPackageSegment, validateSlug } from "./names.mjs";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const area = requireOption(options, "area");
  const feature = requireOption(options, "feature");
  const scenario = requireOption(options, "scenario");
  const url = requireOption(options, "url");
  const draftDir = requireOption(options, "draft-dir");
  const playwrightVersion = optionalOption(options, "playwright-version", "1.52.0");
  const baseUrl = optionalOption(options, "base-url");
  const relativePath = optionalOption(options, "path", "/");
  const testIdAttribute = optionalOption(options, "test-id-attribute");
  const force = booleanOption(options, "force");

  validateJavaPackageSegment(area, "area");
  validateSlug(feature, "feature");

  await mkdir(draftDir, { recursive: true });

  const recordingPath = path.join(draftDir, "recording.java");
  const metadataPath = path.join(draftDir, "metadata.json");
  if (existsSync(recordingPath) && !force) {
    throw new Error(`Refusing to overwrite existing recording without --force: ${recordingPath}`);
  }

  const metadata = {
    area,
    feature,
    scenario,
    ...(baseUrl ? { baseUrl } : {}),
    url,
    resolvedUrl: url,
    path: relativePath,
    recording: "recording.java",
    createdAt: new Date().toISOString()
  };

  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = [
    "exec",
    "--yes",
    "--package",
    `playwright@${playwrightVersion}`,
    "--",
    "playwright",
    "codegen",
    "--target=java",
    "-o",
    recordingPath,
    url
  ];

  if (testIdAttribute) {
    args.splice(args.indexOf("codegen") + 1, 0, "--test-id-attribute", testIdAttribute);
  }

  console.log(`Recording ${area}/${feature} to ${recordingPath}`);
  console.log("Close the Playwright codegen window when the flow is complete.");

  const result = spawnSync(npmExecutable, args, {
    stdio: "inherit",
    env: process.env
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
