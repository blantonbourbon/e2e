import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ensureOutputIsSafe, requireDirectory } from "./utils.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const staticServerPath = join(currentDir, "static-server.mjs");
const defaultHost = "127.0.0.1";
const defaultPort = 8790;

export async function assertPortFree({ host = defaultHost, port = defaultPort } = {}) {
  const server = createServer();

  try {
    await new Promise((resolveListen, rejectListen) => {
      server.once("error", (error) => {
        if (error.code === "EADDRINUSE") {
          rejectListen(
            new Error(
              `Port ${host}:${port} is not available. Stop the unrelated process or choose a different port; the Cypress migration oracle will not kill it.`,
            ),
          );
          return;
        }
        rejectListen(new Error(`Could not preflight ${host}:${port}: ${error.message}`));
      });
      server.listen({ host, port }, resolveListen);
    });
  } finally {
    if (server.listening) {
      await new Promise((resolveClose, rejectClose) =>
        server.close((error) => (error == null ? resolveClose() : rejectClose(error))),
      );
    }
  }
}

export async function isPortFree({ host = defaultHost, port = defaultPort } = {}) {
  try {
    await assertPortFree({ host, port });
    return true;
  } catch {
    return false;
  }
}

export async function runSyntheticOracle({
  sourceRoot,
  outputDir,
  repoRoot = null,
  host = defaultHost,
  port = defaultPort,
  timeoutMs = 15_000,
  runCypress = runCypressProcess,
} = {}) {
  if (typeof sourceRoot !== "string" || sourceRoot.trim().length === 0) {
    throw new Error("Missing required option: --source-root");
  }
  if (typeof outputDir !== "string" || outputDir.trim().length === 0) {
    throw new Error("Missing required option: --output-dir");
  }

  const resolvedSourceRoot = resolve(sourceRoot);
  const resolvedOutputDir = resolve(outputDir);
  ensureOutputIsSafe(resolvedSourceRoot, resolvedOutputDir, { repoRoot });
  const appRoot = join(resolvedSourceRoot, "app");
  const baseUrl = `http://${host}:${port}`;

  await requireDirectory(resolvedSourceRoot, "Synthetic Cypress source root");
  await requireDirectory(appRoot, "Synthetic Cypress static app root");
  await mkdir(resolvedOutputDir, { recursive: true });
  await assertPortFree({ host, port });

  const serverProcess = startStaticServerProcess({ appRoot, host, port });
  let cypressResult = null;
  let cleanup = {
    stoppedOwnedPid: null,
    stopSignal: null,
    alreadyExited: false,
    portReleased: false,
  };

  try {
    await waitForHttpOk(`${baseUrl}/`, serverProcess, timeoutMs);
    cypressResult = await runCypress({
      sourceRoot: resolvedSourceRoot,
      baseUrl,
      host,
      port,
      serverPid: serverProcess.pid,
    });
  } catch (error) {
    cypressResult = {
      exitCode: 1,
      stdout: "",
      stderr: error.message,
    };
  } finally {
    cleanup = await stopOwnedProcess(serverProcess, { host, port });
  }

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: cypressResult.exitCode === 0 ? "passed" : "failed",
    exitCode: cypressResult.exitCode,
    sourceRoot: resolvedSourceRoot,
    baseUrl,
    server: {
      host,
      port,
      pid: serverProcess.pid,
      stdout: serverProcess.output.stdout.join(""),
      stderr: serverProcess.output.stderr.join(""),
    },
    cypress: {
      command: cypressResult.command ?? "custom runCypress callback",
      stdout: cypressResult.stdout ?? "",
      stderr: cypressResult.stderr ?? "",
    },
    cleanup,
  };

  const evidence = await writeOracleEvidence(result, { outputDir: resolvedOutputDir });
  return {
    ...result,
    evidenceJsonPath: evidence.jsonPath,
    evidenceMarkdownPath: evidence.markdownPath,
  };
}

function startStaticServerProcess({ appRoot, host, port }) {
  const child = spawn(process.execPath, [
    staticServerPath,
    "--root",
    appRoot,
    "--host",
    host,
    "--port",
    String(port),
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.output = {
    stdout: [],
    stderr: [],
  };
  child.stdout.on("data", (chunk) => child.output.stdout.push(chunk.toString()));
  child.stderr.on("data", (chunk) => child.output.stderr.push(chunk.toString()));
  return child;
}

async function waitForHttpOk(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    if (child.exitCode != null || child.signalCode != null) {
      throw new Error(
        `Synthetic Cypress static server exited before it became ready. stdout=${child.output.stdout.join("")} stderr=${child.output.stderr.join("")}`,
      );
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw new Error(`Synthetic Cypress static server did not become ready at ${url}: ${lastError?.message ?? "timeout"}`);
}

async function stopOwnedProcess(child, { host, port }) {
  const cleanup = {
    stoppedOwnedPid: child.pid,
    stopSignal: null,
    alreadyExited: child.exitCode != null || child.signalCode != null,
    portReleased: false,
  };

  if (!cleanup.alreadyExited) {
    child.kill("SIGTERM");
    cleanup.stopSignal = "SIGTERM";
    const timedOut = await Promise.race([
      once(child, "exit").then(() => false),
      delay(3_000).then(() => true),
    ]);

    if (timedOut) {
      child.kill("SIGKILL");
      cleanup.stopSignal = "SIGKILL";
      await once(child, "exit");
    }
  }

  cleanup.portReleased = await waitForPortRelease({ host, port });
  return cleanup;
}

async function waitForPortRelease({ host, port }) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await isPortFree({ host, port })) {
      return true;
    }
    await delay(100);
  }
  return false;
}

export async function runCypressProcess({ sourceRoot, baseUrl }) {
  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  return runProcess(npmExecutable, ["test", "--", "--config", `baseUrl=${baseUrl}`], {
    cwd: sourceRoot,
    env: {
      ...process.env,
      CYPRESS_BASE_URL: baseUrl,
    },
  });
}

export async function runProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk.toString()));
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));

  const exit = await new Promise((resolveExit) => {
    child.once("error", (error) => {
      resolveExit({ exitCode: 1, spawnError: error });
    });
    child.once("exit", (exitCode, signal) => {
      resolveExit({ exitCode: exitCode ?? 1, signal });
    });
  });
  if (exit.spawnError != null) {
    stderr.push(exit.spawnError.message);
  }

  return {
    command: [command, ...args].join(" "),
    exitCode: exit.exitCode,
    stdout: stdout.join(""),
    stderr: stderr.join(""),
  };
}

async function writeOracleEvidence(result, { outputDir }) {
  const jsonPath = join(outputDir, "oracle-result.json");
  const markdownPath = join(outputDir, "oracle-result.md");
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(markdownPath, renderOracleMarkdown(result));
  return { jsonPath, markdownPath };
}

function renderOracleMarkdown(result) {
  const lines = [
    "# Synthetic Cypress Oracle",
    "",
    `Status: **${result.status}**`,
    `Base URL: \`${result.baseUrl}\``,
    `Server PID: \`${result.server.pid}\``,
    `Stopped owned PID: \`${result.cleanup.stoppedOwnedPid}\``,
    `Port released: \`${result.cleanup.portReleased}\``,
    "",
    "## Cypress stdout",
    "",
    "```text",
    trimForMarkdown(result.cypress.stdout),
    "```",
    "",
  ];

  if (result.cypress.stderr.trim().length > 0) {
    lines.push("## Cypress stderr", "", "```text", trimForMarkdown(result.cypress.stderr), "```", "");
  }

  if (result.server.stderr.trim().length > 0) {
    lines.push("## Server stderr", "", "```text", trimForMarkdown(result.server.stderr), "```", "");
  }

  return `${lines.join("\n")}\n`;
}

function trimForMarkdown(value) {
  const text = String(value ?? "").trim();
  return text.length === 0 ? "(none)" : text;
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
