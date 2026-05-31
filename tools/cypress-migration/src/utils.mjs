import { readdir, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

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

export function ensureOutputIsSafe(sourceRoot, outputDir) {
  const source = resolve(sourceRoot);
  const output = resolve(outputDir);
  const relativeToSource = relative(source, output);

  if (relativeToSource === "") {
    throw new Error("Refusing to write migration output directly into the Cypress source root");
  }

  const posix = toPosixPath(relativeToSource);
  const unsafePrefixes = ["cypress/e2e", "cypress/support", "cypress/fixtures"];
  if (!relativeToSource.startsWith("..") && unsafePrefixes.some((prefix) => posix === prefix || posix.startsWith(`${prefix}/`))) {
    throw new Error(
      "Refusing to write migration output inside Cypress source directory; choose an ignored build output directory",
    );
  }
}
