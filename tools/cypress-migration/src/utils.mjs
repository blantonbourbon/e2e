import { readdir, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

export function toPosixPath(path) {
  return path.split(sep).join("/");
}

export function sortByPath(entries) {
  return [...entries].sort((left, right) => left.path.localeCompare(right.path));
}

export function unique(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))].sort();
}

export function countLine(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

export async function requireDirectory(path, label) {
  let stats;
  try {
    stats = await stat(path);
  } catch {
    throw new Error(`${label} ${path} does not exist or is not a directory`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`${label} ${path} does not exist or is not a directory`);
  }
}

export async function listFiles(root) {
  const rootPath = resolve(root);
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name);
      const relativePath = toPosixPath(relative(rootPath, absolutePath));
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === "build" ||
          entry.name === "dist" ||
          entry.name === ".git" ||
          entry.name === ".gradle"
        ) {
          continue;
        }
        await visit(absolutePath);
      } else if (entry.isFile()) {
        files.push({
          path: relativePath,
          absolutePath,
          extension: extname(entry.name),
        });
      }
    }
  }

  await visit(rootPath);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export function isCySpec(path) {
  return /\.cy\.(js|jsx|ts|tsx|mjs|cjs)$/.test(path);
}

export function isFeature(path) {
  return path.endsWith(".feature");
}

export function isSupportSource(path) {
  return /^cypress\/support\/.+\.(js|jsx|ts|tsx|mjs|cjs)$/.test(path);
}

export function isFixture(path) {
  return path.startsWith("cypress/fixtures/");
}

export function isConfig(path) {
  return /^cypress\.config\.(js|mjs|cjs|ts)$/.test(path);
}

export function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function compactSlug(value) {
  return slug(value).replace(/-/g, "");
}

export function ensureOutputIsSafe(sourceRoot, outputDir, { repoRoot = null } = {}) {
  const source = resolve(sourceRoot);
  const output = resolve(outputDir);

  if (isSameOrInside(source, output) && !isSameOrInside(resolve(source, "build"), output)) {
    const cypressSourcePath = unsafeCypressSourcePath(source, output);
    const label = cypressSourcePath == null
      ? "the Cypress source root"
      : `Cypress source directory ${cypressSourcePath}`;
    throw unsafeOutputError(label);
  }

  if (repoRoot != null && String(repoRoot).trim().length > 0) {
    const repo = resolve(repoRoot);
    if (!isSameOrInside(repo, output)) {
      return;
    }

    const protectedPath = protectedRepositoryPath(repo, output);
    if (protectedPath != null) {
      throw unsafeOutputError(`protected repository path ${protectedPath}`);
    }

    if (isIgnoredBuildOutput(repo, output)) {
      return;
    }

    const repoRelative = toPosixPath(relative(repo, output));
    throw unsafeOutputError(`repository path ${repoRelative || "."}`);
  }
}

function unsafeOutputError(label) {
  return new Error(
    `Refusing to write migration output inside ${label}; choose an ignored build output directory such as build/cypress-migration.`,
  );
}

function unsafeCypressSourcePath(source, output) {
  const unsafePaths = [
    "cypress/e2e",
    "cypress/support",
    "cypress/fixtures",
    "cypress",
  ];

  const match = unsafePaths.find((unsafePath) => isSameOrInside(resolve(source, unsafePath), output));
  return match == null ? null : match;
}

function protectedRepositoryPath(repo, output) {
  const protectedPaths = [
    "test-suite/src/test/resources/features",
    "test-suite/src/test/java",
    "core/src",
    "tools/cypress-migration/src",
    "tools/cypress-migration/test",
    "tools/case-recorder/src",
    "tools/case-recorder/test",
    "synthetic-cypress/cypress",
    "synthetic-cypress/app",
    ".windsurf",
    ".codex",
    "docs",
  ];

  const matches = protectedPaths
    .filter((protectedPath) => isSameOrInside(resolve(repo, protectedPath), output))
    .sort((left, right) => right.length - left.length);
  return matches[0] ?? null;
}

function isIgnoredBuildOutput(repo, output) {
  const relativeToRepo = relative(repo, output);
  if (!isRelativeInside(relativeToRepo)) {
    return false;
  }

  return toPosixPath(relativeToRepo).split("/").includes("build");
}

function isSameOrInside(parent, child) {
  const relativePath = relative(parent, child);
  return relativePath === "" || isRelativeInside(relativePath);
}

function isRelativeInside(relativePath) {
  return relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}
