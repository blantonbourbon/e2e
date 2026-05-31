import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(toolRoot, "../..");
const syntheticRoot = join(repoRoot, "synthetic-cypress");
const cliPath = join(toolRoot, "src/cli.mjs");

function runCli(command, { sourceRoot = syntheticRoot, outputDir, repoRootOverride }) {
  return spawnSync(
    process.execPath,
    [
      cliPath,
      command,
      "--source-root",
      sourceRoot,
      "--output-dir",
      outputDir,
      "--repo-root",
      repoRootOverride,
      "--port",
      "1",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
}

async function writeSentinel(directory) {
  await mkdir(directory, { recursive: true });
  const sentinelPath = join(directory, "keep.txt");
  await writeFile(sentinelPath, "pre-existing file\n");
  return sentinelPath;
}

async function createMinimalCypressProject() {
  const sourceRoot = await mkdtemp(join(tmpdir(), "cypress-source-safety-project-"));
  await mkdir(join(sourceRoot, "cypress/e2e"), { recursive: true });
  await mkdir(join(sourceRoot, "cypress/support"), { recursive: true });
  await mkdir(join(sourceRoot, "cypress/fixtures"), { recursive: true });
  await writeFile(join(sourceRoot, "cypress.config.ts"), "export default {};\n");
  await writeFile(
    join(sourceRoot, "cypress/e2e/sample.cy.ts"),
    `describe("Sample", () => { it("works", () => { cy.visit("/"); }); });\n`,
  );
  return sourceRoot;
}

describe("Cypress migration output directory safety", () => {
  it("rejects every artifact-writing command before writing to protected repository documentation", async () => {
    const fakeRepoRoot = await mkdtemp(join(tmpdir(), "cypress-output-repo-"));
    const docsDir = join(fakeRepoRoot, "docs");
    const sentinelPath = await writeSentinel(docsDir);

    try {
      for (const command of ["inventory", "risk", "draft", "oracle", "evidence", "check"]) {
        const result = runCli(command, {
          outputDir: docsDir,
          repoRootOverride: fakeRepoRoot,
        });

        assert.notEqual(result.status, 0, `${command} should reject docs output`);
        assert.match(result.stderr, /Refusing to write migration output .*docs/);
        assert.match(result.stderr, /ignored build output directory/);
        assert.doesNotMatch(result.stderr, /\n\s+at\s/);
        assert.equal(await readFile(sentinelPath, "utf8"), "pre-existing file\n");
        assert.equal(existsSync(join(docsDir, "inventory.json")), false);
        assert.equal(existsSync(join(docsDir, "risk-flags.md")), false);
        assert.equal(existsSync(join(docsDir, "oracle-result.json")), false);
        assert.equal(existsSync(join(docsDir, "evidence-summary.json")), false);
      }
    } finally {
      await rm(fakeRepoRoot, { recursive: true, force: true });
    }
  });

  it("rejects protected repository source, docs, workflow, and skill destinations without changing existing files", async () => {
    const fakeRepoRoot = await mkdtemp(join(tmpdir(), "cypress-protected-repo-"));
    const protectedDestinations = [
      "docs",
      ".windsurf",
      ".codex",
      "test-suite/src/test/resources/features",
      "test-suite/src/test/java",
      "core/src/main/java",
      "tools/cypress-migration/src",
      "tools/cypress-migration/test",
    ];

    try {
      for (const destination of protectedDestinations) {
        const outputDir = join(fakeRepoRoot, destination);
        const sentinelPath = await writeSentinel(outputDir);
        const result = runCli("inventory", {
          outputDir,
          repoRootOverride: fakeRepoRoot,
        });

        assert.notEqual(result.status, 0, `${destination} should be rejected`);
        assert.match(result.stderr, /Refusing to write migration output/);
        assert.match(result.stderr, /ignored build output directory/);
        assert.doesNotMatch(result.stderr, /\n\s+at\s/);
        assert.equal(await readFile(sentinelPath, "utf8"), "pre-existing file\n");
        assert.equal(existsSync(join(outputDir, "inventory.json")), false);
      }
    } finally {
      await rm(fakeRepoRoot, { recursive: true, force: true });
    }
  });

  it("rejects Cypress source roots while preserving pre-existing Cypress files", async () => {
    const sourceRoot = await createMinimalCypressProject();
    const repoRootOverride = await mkdtemp(join(tmpdir(), "cypress-source-repo-"));
    const protectedDestinations = [
      "",
      "cypress",
      "cypress/e2e",
      "cypress/support",
      "cypress/fixtures",
    ];

    try {
      for (const destination of protectedDestinations) {
        const outputDir = join(sourceRoot, destination);
        const result = runCli("inventory", {
          sourceRoot,
          outputDir,
          repoRootOverride,
        });

        assert.notEqual(result.status, 0, `${destination || "source root"} should be rejected`);
        assert.match(result.stderr, /Refusing to write migration output .*Cypress source/);
        assert.match(result.stderr, /ignored build output directory/);
        assert.doesNotMatch(result.stderr, /\n\s+at\s/);
        assert.equal(
          await readFile(join(sourceRoot, "cypress/e2e/sample.cy.ts"), "utf8"),
          `describe("Sample", () => { it("works", () => { cy.visit("/"); }); });\n`,
        );
        assert.equal(existsSync(join(outputDir, "inventory.json")), false);
      }
    } finally {
      await rm(sourceRoot, { recursive: true, force: true });
      await rm(repoRootOverride, { recursive: true, force: true });
    }
  });

  it("preserves documented ignored build-output behavior", async () => {
    const fakeRepoRoot = await mkdtemp(join(tmpdir(), "cypress-safe-build-repo-"));
    const outputDir = join(fakeRepoRoot, "build/cypress-migration");

    try {
      const result = runCli("inventory", {
        outputDir,
        repoRootOverride: fakeRepoRoot,
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /Wrote Cypress migration inventory/);
      assert.equal((await stat(join(outputDir, "inventory.json"))).isFile(), true);
      assert.equal((await stat(join(outputDir, "draft-features/catalog.feature"))).isFile(), true);
    } finally {
      await rm(fakeRepoRoot, { recursive: true, force: true });
    }
  });

  it("allows ignored build output under an explicit Cypress source root", async () => {
    const sourceRoot = await createMinimalCypressProject();
    const repoRootOverride = await mkdtemp(join(tmpdir(), "cypress-safe-source-build-repo-"));
    const outputDir = join(sourceRoot, "build/cypress-migration");

    try {
      const result = runCli("inventory", {
        sourceRoot,
        outputDir,
        repoRootOverride,
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /Wrote Cypress migration inventory/);
      assert.equal((await stat(join(outputDir, "inventory.json"))).isFile(), true);
      assert.equal(
        await readFile(join(sourceRoot, "cypress/e2e/sample.cy.ts"), "utf8"),
        `describe("Sample", () => { it("works", () => { cy.visit("/"); }); });\n`,
      );
    } finally {
      await rm(sourceRoot, { recursive: true, force: true });
      await rm(repoRootOverride, { recursive: true, force: true });
    }
  });
});
