import { accessSync, constants, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const TOOL_CHECKS = [
  {
    name: "node",
    label: "Node.js",
    versionArgs: ["--version"],
    minimumMajor: 20,
    parseMajor: parseSemverMajor
  },
  {
    name: "npm",
    windowsName: "npm.cmd",
    label: "npm",
    versionArgs: ["--version"],
    parseMajor: parseSemverMajor
  },
  {
    name: "java",
    label: "Java",
    versionArgs: ["-version"],
    minimumMajor: 21,
    parseMajor: parseJavaMajor
  }
];

export function runPreflight({
  platform = process.platform,
  env = process.env,
  repoRoot = process.cwd(),
  resolveCommand = (command) => resolveSystemCommand(command, platform),
  readCommandOutput = readSystemCommandOutput,
  fileExists = existsSync,
  fileExecutable = isExecutable
} = {}) {
  const checks = [];
  const runningInWsl = Boolean(env.WSL_DISTRO_NAME || env.WSL_INTEROP);

  if (platform === "win32" && isUncPath(repoRoot)) {
    checks.push(fail(
      "Repository path",
      `Windows Gradle/recorder tasks must run from a Windows-local checkout, not a UNC path: ${repoRoot}`
    ));
  }

  if (runningInWsl && platform === "win32") {
    checks.push(fail(
      "WSL runtime",
      "case recorder is running with a Windows Node.js executable inside WSL; use WSL Node.js instead"
    ));
  }

  for (const tool of TOOL_CHECKS) {
    checks.push(checkTool(tool, { platform, resolveCommand, readCommandOutput }));
  }

  checks.push(checkGradleWrapper(repoRoot, { platform, fileExists, fileExecutable }));

  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

export function formatPreflightResult(result) {
  const lines = [`Case recorder preflight: ${result.ok ? "OK" : "FAILED"}`];

  for (const check of result.checks) {
    const marker = check.ok ? "OK" : "FAIL";
    lines.push(`[${marker}] ${check.label}: ${check.message}`);
  }

  return `${lines.join("\n")}\n`;
}

function checkTool(tool, options) {
  const commandName = options.platform === "win32" && tool.windowsName ? tool.windowsName : tool.name;
  const resolvedPath = options.resolveCommand(commandName);
  if (!resolvedPath) {
    return fail(tool.label, `${commandName} was not found on PATH`);
  }

  if (options.platform !== "win32" && isWindowsBackedPath(resolvedPath)) {
    return fail(
      tool.label,
      `${commandName} resolved to ${resolvedPath}; install/use the WSL ${tool.name} executable instead`
    );
  }

  let versionText;
  try {
    versionText = options.readCommandOutput(resolvedPath, tool.versionArgs, tool.name);
  } catch (error) {
    return fail(tool.label, `${commandName} is present at ${resolvedPath} but version check failed: ${error.message}`);
  }

  const major = tool.parseMajor(versionText);
  if (major == null) {
    return fail(tool.label, `could not parse version from ${JSON.stringify(versionText.trim())}`);
  }

  if (tool.minimumMajor != null && major < tool.minimumMajor) {
    return fail(tool.label, `${tool.name} ${major} is too old; require ${tool.minimumMajor}+ at ${resolvedPath}`);
  }

  return pass(tool.label, `${tool.name} ${firstLine(versionText)} at ${resolvedPath}`);
}

function checkGradleWrapper(repoRoot, { platform, fileExists, fileExecutable }) {
  const wrapperName = platform === "win32" ? "gradlew.bat" : "gradlew";
  const gradlewPath = path.join(repoRoot, wrapperName);
  if (!fileExists(gradlewPath)) {
    return fail("Gradle wrapper", `missing ${gradlewPath}`);
  }
  if (platform !== "win32" && !fileExecutable(gradlewPath)) {
    return fail("Gradle wrapper", `${gradlewPath} is not executable`);
  }
  return pass(
    "Gradle wrapper",
    platform === "win32"
      ? `${gradlewPath} is present`
      : `${gradlewPath} is present and executable`
  );
}

function resolveSystemCommand(command, platform) {
  const result = platform === "win32"
    ? spawnSync("where", [command], { encoding: "utf8" })
    : spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });

  if (result.error || result.status !== 0) {
    return null;
  }

  return firstLine(result.stdout);
}

function readSystemCommandOutput(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32" && /\.cmd$/i.test(command)
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `exit ${result.status}`).trim());
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function parseSemverMajor(text) {
  const match = text.trim().match(/^v?(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseJavaMajor(text) {
  const match = text.match(/version "([^"]+)"/) ?? text.match(/^(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const version = match[1];
  if (version.startsWith("1.")) {
    return Number.parseInt(version.split(".")[1], 10);
  }
  return Number.parseInt(version.split(".")[0], 10);
}

function isWindowsBackedPath(value) {
  return /^\/mnt\/[a-z]\//i.test(value) || /^[a-z]:[\\/]/i.test(value);
}

function isUncPath(value) {
  return /^\\\\/.test(value);
}

function firstLine(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function pass(label, message) {
  return { label, ok: true, message };
}

function fail(label, message) {
  return { label, ok: false, message };
}
