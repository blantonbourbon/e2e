import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(toolRoot, "../..");
const syntheticRoot = join(repoRoot, "synthetic-cypress");
const cliPath = join(toolRoot, "src/cli.mjs");

async function sourceHashes(root) {
  const hashes = {};

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "build") {
          continue;
        }
        await visit(absolutePath);
      } else if (entry.isFile()) {
        const relativePath = relative(root, absolutePath);
        const content = await readFile(absolutePath);
        hashes[relativePath] = createHash("sha256").update(content).digest("hex");
      }
    }
  }

  await visit(root);
  return hashes;
}

describe("Cypress migration source safety", () => {
  it("generates into a custom output directory without modifying Cypress source files", async () => {
    const before = await sourceHashes(syntheticRoot);
    const outputDir = await mkdtemp(join(tmpdir(), "cypress-source-safe-output-"));

    try {
      const result = spawnSync(
        process.execPath,
        [cliPath, "inventory", "--source-root", syntheticRoot, "--output-dir", outputDir],
        {
          cwd: repoRoot,
          encoding: "utf8",
        },
      );

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /Wrote Cypress migration inventory/);

      const after = await sourceHashes(syntheticRoot);
      assert.deepEqual(after, before);

      const generatedFiles = [
        "inventory.json",
        "inventory.md",
        "risk-flags.md",
        "draft-features/catalog.feature",
      ];
      for (const generatedFile of generatedFiles) {
        const fileStat = await stat(join(outputDir, generatedFile));
        assert.equal(fileStat.isFile(), true);
      }
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
