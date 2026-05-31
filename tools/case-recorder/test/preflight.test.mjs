import test from "node:test";
import assert from "node:assert/strict";
import { formatPreflightResult, runPreflight } from "../src/preflight.mjs";

test("preflight passes when required WSL tools are available", () => {
  const result = runPreflight({
    platform: "linux",
    env: { WSL_DISTRO_NAME: "Ubuntu" },
    repoRoot: "/repo",
    resolveCommand: command => `/usr/bin/${command}`,
    readCommandOutput: (_command, _args, toolName) => ({
      node: "v20.12.2\n",
      npm: "10.5.0\n",
      java: 'openjdk version "21.0.3" 2024-04-16\n'
    })[toolName],
    fileExists: () => true,
    fileExecutable: () => true
  });

  assert.equal(result.ok, true);
  assert.match(formatPreflightResult(result), /Case recorder preflight: OK/);
});

test("preflight passes on Windows using npm.cmd and gradlew.bat", () => {
  const result = runPreflight({
    platform: "win32",
    env: {},
    repoRoot: "C:\\repo",
    resolveCommand: command => ({
      "node": "C:\\nvm4w\\nodejs\\node.exe",
      "npm.cmd": "C:\\nvm4w\\nodejs\\npm.cmd",
      "java": "C:\\Users\\kratos\\.sdkman\\candidates\\java\\current\\bin\\java.exe"
    })[command],
    readCommandOutput: (_command, _args, toolName) => ({
      node: "v24.16.0\n",
      npm: "11.13.0\n",
      java: 'openjdk version "21.0.11" 2026-04-21 LTS\n'
    })[toolName],
    fileExists: filePath => filePath.endsWith("gradlew.bat"),
    fileExecutable: () => false
  });

  assert.equal(result.ok, true);
  assert.match(result.checks.find(check => check.label === "npm").message, /npm\.cmd/);
});

test("preflight rejects Windows UNC repository paths", () => {
  const result = runPreflight({
    platform: "win32",
    env: {},
    repoRoot: "\\\\wsl.localhost\\Ubuntu-24.04\\home\\kratos\\projects\\e2e",
    resolveCommand: command => ({
      "node": "C:\\nvm4w\\nodejs\\node.exe",
      "npm.cmd": "C:\\nvm4w\\nodejs\\npm.cmd",
      "java": "C:\\Users\\kratos\\.sdkman\\candidates\\java\\current\\bin\\java.exe"
    })[command],
    readCommandOutput: (_command, _args, toolName) => ({
      node: "v24.16.0\n",
      npm: "11.13.0\n",
      java: 'openjdk version "21.0.11" 2026-04-21 LTS\n'
    })[toolName],
    fileExists: () => true,
    fileExecutable: () => false
  });

  assert.equal(result.ok, false);
  assert.match(result.checks.find(check => check.label === "Repository path").message, /UNC path/);
});

test("preflight rejects Windows-backed executables in WSL", () => {
  const result = runPreflight({
    platform: "linux",
    env: { WSL_DISTRO_NAME: "Ubuntu" },
    repoRoot: "/repo",
    resolveCommand: command => command === "npm" ? "/mnt/c/nvm4w/nodejs/npm" : `/usr/bin/${command}`,
    readCommandOutput: (_command, _args, toolName) => ({
      node: "v20.12.2\n",
      npm: "10.5.0\n",
      java: 'openjdk version "21.0.3" 2024-04-16\n'
    })[toolName],
    fileExists: () => true,
    fileExecutable: () => true
  });

  assert.equal(result.ok, false);
  assert.match(result.checks.find(check => check.label === "npm").message, /WSL npm executable/);
});

test("preflight fails when Java is older than the framework requires", () => {
  const result = runPreflight({
    platform: "linux",
    env: {},
    repoRoot: "/repo",
    resolveCommand: command => `/usr/bin/${command}`,
    readCommandOutput: (_command, _args, toolName) => ({
      node: "v20.12.2\n",
      npm: "10.5.0\n",
      java: 'openjdk version "17.0.10" 2024-01-16\n'
    })[toolName],
    fileExists: () => true,
    fileExecutable: () => true
  });

  assert.equal(result.ok, false);
  assert.match(result.checks.find(check => check.label === "Java").message, /require 21\+/);
});
