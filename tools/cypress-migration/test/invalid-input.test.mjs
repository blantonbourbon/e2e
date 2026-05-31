import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(toolRoot, "src/cli.mjs");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: toolRoot,
    encoding: "utf8",
  });
}

describe("Cypress migration CLI input validation", () => {
  it("fails clearly for a missing source root without a stack trace", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "cypress-invalid-output-"));
    try {
      const result = runCli([
        "inventory",
        "--source-root",
        join(tmpdir(), "does-not-exist-cypress-project"),
        "--output-dir",
        outputDir,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Source root .* does not exist or is not a directory/);
      assert.doesNotMatch(result.stderr, /\n\s+at\s/);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("fails clearly when no Cypress specs or feature inputs exist", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "empty-cypress-project-"));
    const outputDir = await mkdtemp(join(tmpdir(), "empty-cypress-output-"));

    try {
      await writeFile(join(sourceRoot, "cypress.config.ts"), "export default {};\n");
      const result = runCli(["inventory", "--source-root", sourceRoot, "--output-dir", outputDir]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /No Cypress specs or feature files found/);
      assert.doesNotMatch(result.stderr, /\n\s+at\s/);
    } finally {
      await rm(sourceRoot, { recursive: true, force: true });
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("refuses to write migration output inside Cypress source directories", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "unsafe-cypress-project-"));

    try {
      await mkdir(join(sourceRoot, "cypress/e2e"), { recursive: true });
      await writeFile(join(sourceRoot, "cypress.config.ts"), "export default {};\n");
      await writeFile(
        join(sourceRoot, "cypress/e2e/sample.cy.ts"),
        `describe("Sample", () => { it("works", () => { cy.visit("/"); }); });\n`,
      );

      const result = runCli([
        "inventory",
        "--source-root",
        sourceRoot,
        "--output-dir",
        join(sourceRoot, "cypress/e2e/generated"),
      ]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Refusing to write migration output inside Cypress source directory/);
      assert.doesNotMatch(result.stderr, /\n\s+at\s/);
    } finally {
      await rm(sourceRoot, { recursive: true, force: true });
    }
  });

  it("fails clearly when Cypress config and package markers are missing", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "missing-config-cypress-project-"));
    const outputDir = await mkdtemp(join(tmpdir(), "missing-config-cypress-output-"));

    try {
      await mkdir(join(sourceRoot, "cypress/e2e"), { recursive: true });
      await writeFile(
        join(sourceRoot, "cypress/e2e/sample.cy.ts"),
        `describe("Sample", () => { it("works", () => { cy.visit("/"); }); });\n`,
      );

      const result = runCli(["inventory", "--source-root", sourceRoot, "--output-dir", outputDir]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /No cypress\.config\.\* file or Cypress package dependency found/);
      assert.doesNotMatch(result.stderr, /\n\s+at\s/);
    } finally {
      await rm(sourceRoot, { recursive: true, force: true });
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
