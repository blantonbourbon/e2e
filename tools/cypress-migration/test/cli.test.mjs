import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(toolRoot, "../..");
const syntheticRoot = join(repoRoot, "synthetic-cypress");
const cliPath = join(toolRoot, "src/cli.mjs");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

describe("Cypress migration CLI commands", () => {
  it("documents inventory, risk, draft, oracle, evidence, and aggregate check usage", () => {
    const result = runCli(["--help"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /inventory\s+Mine Cypress source/);
    assert.match(result.stdout, /risk\s+Generate reviewable risk flags/);
    assert.match(result.stdout, /draft\s+Generate review-first Cucumber feature sketches/);
    assert.match(result.stdout, /oracle\s+Run the synthetic Cypress oracle/);
    assert.match(result.stdout, /evidence\s+Map synthetic Cypress tests/);
    assert.match(result.stdout, /check\s+Run the full Cypress migration check/);
    assert.match(result.stdout, /--source-root <path>/);
    assert.match(result.stdout, /--output-dir <path>/);
    assert.match(result.stdout, /evidence --source-root <path> --output-dir <path> --repo-root <path>/);
    assert.match(result.stdout, /--cypress-status <status>/);
    assert.match(result.stdout, /--playwright-status <status>/);
    assert.match(result.stdout, /--port <number>.*8790/);
    assert.match(result.stdout, /Artifact-writing commands write review evidence under --output-dir/);
    assert.match(result.stdout, /refuse\s+output locations inside Cypress source roots/);
    assert.match(result.stdout, /docs\/, \.windsurf\/, \.codex\//);
    assert.match(result.stdout, /build\/cypress-migration/);
    assert.match(result.stdout, /aggregate check also runs\s+Gradle validation/);
    assert.match(result.stdout, /:test-suite:cypressMigrationCheck/);
  });

  it("accepts risk and draft commands as explicit generation entry points", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "cypress-cli-output-"));

    try {
      const riskResult = runCli([
        "risk",
        "--source-root",
        syntheticRoot,
        "--output-dir",
        outputDir,
      ]);
      assert.equal(riskResult.status, 0, riskResult.stderr || riskResult.stdout);
      assert.match(riskResult.stdout, /Wrote Cypress migration risk flags/);
      assert.equal((await stat(join(outputDir, "risk-flags.md"))).isFile(), true);

      const draftResult = runCli([
        "draft",
        "--source-root",
        syntheticRoot,
        "--output-dir",
        outputDir,
      ]);
      assert.equal(draftResult.status, 0, draftResult.stderr || draftResult.stdout);
      assert.match(draftResult.stdout, /Wrote Cypress migration draft feature/);
      assert.equal((await stat(join(outputDir, "draft-features/catalog.feature"))).isFile(), true);

      const draftFeature = await readFile(join(outputDir, "draft-features/catalog.feature"), "utf8");
      assert.match(draftFeature, /# REVIEW: Generated draft; do not promote without manual migration review\./);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
