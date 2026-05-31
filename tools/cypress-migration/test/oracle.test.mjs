import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { runSyntheticOracle } from "../src/oracle.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const syntheticRoot = join(repoRoot, "synthetic-cypress");

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error == null ? resolve() : reject(error))));
  return port;
}

async function bindPort(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port }, resolve);
  });
  return server;
}

async function portCanBind(port) {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen({ host: "127.0.0.1", port }, resolve);
    });
    return true;
  } catch {
    return false;
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) => server.close((error) => (error == null ? resolve() : reject(error))));
    }
  }
}

function pidIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("Synthetic Cypress oracle server lifecycle", () => {
  it("starts a loopback static server, writes evidence, and stops the exact PID it started", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "cypress-oracle-output-"));
    const port = await reservePort();
    let serverPid;

    try {
      const result = await runSyntheticOracle({
        sourceRoot: syntheticRoot,
        outputDir,
        port,
        runCypress: async ({ baseUrl, serverPid: ownedPid }) => {
          serverPid = ownedPid;
          const response = await fetch(`${baseUrl}/catalog.html`);
          assert.equal(response.status, 200);
          const body = await response.text();
          assert.match(body, /Product catalog/);
          return {
            exitCode: 0,
            stdout: "fake Cypress run passed",
            stderr: "",
          };
        },
      });

      assert.equal(result.exitCode, 0);
      assert.equal(result.server.host, "127.0.0.1");
      assert.equal(result.server.port, port);
      assert.equal(result.cleanup.stoppedOwnedPid, serverPid);
      assert.equal(result.cleanup.portReleased, true);
      assert.equal(pidIsAlive(serverPid), false);
      assert.equal(await portCanBind(port), true);

      const evidence = JSON.parse(await readFile(join(outputDir, "oracle-result.json"), "utf8"));
      assert.equal(evidence.status, "passed");
      assert.equal(evidence.server.pid, serverPid);
      assert.equal(evidence.cleanup.stoppedOwnedPid, serverPid);
      assert.equal(evidence.cleanup.portReleased, true);

      const markdown = await readFile(join(outputDir, "oracle-result.md"), "utf8");
      assert.match(markdown, /Synthetic Cypress Oracle/);
      assert.match(markdown, /fake Cypress run passed/);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("fails actionably when the requested port is already occupied without running Cypress", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "cypress-oracle-occupied-"));
    const port = await reservePort();
    const blocker = await bindPort(port);
    let cypressRan = false;

    try {
      await assert.rejects(
        () =>
          runSyntheticOracle({
            sourceRoot: syntheticRoot,
            outputDir,
            port,
            runCypress: async () => {
              cypressRan = true;
              return { exitCode: 0, stdout: "", stderr: "" };
            },
          }),
        new RegExp(`Port 127\\.0\\.0\\.1:${port} is not available`),
      );
      assert.equal(cypressRan, false);
      assert.equal(blocker.listening, true);
    } finally {
      await new Promise((resolve, reject) => blocker.close((error) => (error == null ? resolve() : reject(error))));
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
