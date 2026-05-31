import { readFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

import {
  compactSlug,
  countLine,
  ensureOutputIsSafe,
  isConfig,
  isCySpec,
  isFeature,
  isFixture,
  isSupportSource,
  listFiles,
  requireDirectory,
  slug,
  sortByPath,
  toPosixPath,
  unique,
} from "./utils.mjs";

export async function validateMigrationInputs({ sourceRoot, outputDir, repoRoot = null }) {
  if (outputDir != null) {
    ensureOutputIsSafe(sourceRoot, outputDir, { repoRoot });
  }
  await requireDirectory(sourceRoot, "Source root");
}

export async function buildInventory({ sourceRoot, outputDir, repoRoot = null } = {}) {
  if (typeof sourceRoot !== "string" || sourceRoot.trim().length === 0) {
    throw new Error("Missing required option: --source-root");
  }

  const resolvedSourceRoot = resolve(sourceRoot);
  await validateMigrationInputs({ sourceRoot: resolvedSourceRoot, outputDir, repoRoot });

  const files = await listFiles(resolvedSourceRoot);
  const specFiles = files.filter((file) => isCySpec(file.path));
  const featureFiles = files.filter((file) => isFeature(file.path));
  const supportFiles = files.filter((file) => isSupportSource(file.path));
  const fixtureFiles = files.filter((file) => isFixture(file.path));
  const configFiles = files.filter((file) => isConfig(file.path));
  const packageJson = await readPackageJson(files);

  if (specFiles.length === 0 && featureFiles.length === 0) {
    throw new Error(
      `No Cypress specs or feature files found under ${resolvedSourceRoot}. Expected cypress/e2e/**/*.cy.{js,ts} or cypress/e2e/**/*.feature inputs.`,
    );
  }

  if (configFiles.length === 0 && !hasCypressPackageMarker(packageJson)) {
    throw new Error(
      `No cypress.config.* file or Cypress package dependency found under ${resolvedSourceRoot}. Pass a Cypress project root or a source copy that includes its config/package marker.`,
    );
  }

  const configs = await Promise.all(configFiles.map((file) => parseConfigFile(file)));
  const fixtures = sortByPath(await Promise.all(fixtureFiles.map((file) => parseFixture(file))));
  const customCommands = (await Promise.all(supportFiles.map((file) => parseSupportFile(file)))).flat();
  const commandsByName = new Map(customCommands.map((command) => [command.name, command]));
  const cypressFeatures = sortByPath(await Promise.all(featureFiles.map((file) => parseFeatureFile(file))));
  const parsedSpecs = sortByPath(
    await Promise.all(
      specFiles.map((file) => parseSpecFile(file, {
        commandsByName,
        cypressFeatures,
      })),
    ),
  );

  for (const spec of parsedSpecs) {
    for (const test of spec.tests) {
      for (const usage of test.customCommandUsages) {
        const command = commandsByName.get(usage.name);
        if (command == null) {
          continue;
        }
        const relatedFixtures = test.fixtures.filter(
          (fixture) => fixture.source.contextKind === usage.source.contextKind,
        );
        command.fixtureDependencies = unique([
          ...command.fixtureDependencies,
          ...relatedFixtures.map((fixture) => fixture.name),
        ]);
      }
    }
  }

  for (const feature of cypressFeatures) {
    feature.targetCandidate = deriveCandidate({
      suiteTitle: feature.name,
      featureName: basename(feature.path, extname(feature.path)),
    });
  }

  const risks = parsedSpecs.flatMap((spec) => spec.tests.flatMap((test) => test.risks));
  const reviewItems = risks.map((risk) => ({
    type: risk.type,
    severity: risk.severity,
    source: risk.context,
    message: risk.message,
    suggestion: risk.suggestion,
  }));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot: resolvedSourceRoot,
    inputs: {
      configFiles: configs,
      packageJson,
      specFiles: specFiles.map((file) => file.path),
      featureFiles: featureFiles.map((file) => file.path),
      supportFiles: supportFiles.map((file) => file.path),
      fixtureFiles: fixtureFiles.map((file) => file.path),
    },
    fixtures,
    customCommands: customCommands.sort((left, right) => left.name.localeCompare(right.name)),
    cypressFeatures,
    specs: parsedSpecs,
    risks,
    reviewItems,
  };
}

async function readPackageJson(files) {
  const packageFile = files.find((file) => file.path === "package.json");
  if (packageFile == null) {
    return null;
  }

  try {
    const packageJson = JSON.parse(await readFile(packageFile.absolutePath, "utf8"));
    return {
      path: packageFile.path,
      name: packageJson.name ?? null,
      scripts: Object.keys(packageJson.scripts ?? {}).sort(),
      dependencies: Object.keys(packageJson.dependencies ?? {}).sort(),
      devDependencies: Object.keys(packageJson.devDependencies ?? {}).sort(),
    };
  } catch (error) {
    return {
      path: packageFile.path,
      parseError: `Could not parse package.json: ${error.message}`,
    };
  }
}

function hasCypressPackageMarker(packageJson) {
  if (packageJson == null || packageJson.parseError != null) {
    return false;
  }
  return [...packageJson.dependencies, ...packageJson.devDependencies].includes("cypress");
}

async function parseConfigFile(file) {
  const text = await readFile(file.absolutePath, "utf8");
  return {
    path: file.path,
    baseUrl: readObjectProperty(text, "baseUrl"),
    specPattern: readObjectProperty(text, "specPattern"),
    supportFile: readObjectProperty(text, "supportFile"),
  };
}

async function parseFixture(file) {
  const text = await readFile(file.absolutePath, "utf8");
  const name = basename(file.path, extname(file.path));
  const fixture = {
    name,
    path: file.path,
    topLevelKeys: [],
    nestedKeys: [],
  };

  if (file.path.endsWith(".json")) {
    try {
      const parsed = JSON.parse(text);
      fixture.topLevelKeys = Object.keys(parsed).sort();
      fixture.nestedKeys = collectNestedKeys(parsed);
    } catch (error) {
      fixture.parseError = `Could not parse fixture JSON: ${error.message}`;
    }
  }

  return fixture;
}

function collectNestedKeys(value, prefix = "") {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value)
    .flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return [path, ...collectNestedKeys(child, path)];
    })
    .sort();
}

async function parseSupportFile(file) {
  const text = await readFile(file.absolutePath, "utf8");
  const commands = [];
  const commandRegex = /Cypress\.Commands\.add\s*\(/g;
  let match;

  while ((match = commandRegex.exec(text)) != null) {
    const nameInfo = parseFirstString(text, commandRegex.lastIndex);
    if (nameInfo == null) {
      continue;
    }

    const body = findArrowBlock(text, nameInfo.end);
    if (body == null) {
      continue;
    }

    const signals = extractSignals(body.body, {
      relativePath: file.path,
      contextKind: "custom-command",
      testTitle: null,
      commandsByName: new Map(),
      lineOffset: countLine(text, body.openIndex) - 1,
    });

    commands.push({
      name: nameInfo.value,
      path: file.path,
      line: countLine(text, match.index),
      fixtureDependencies: [],
      stateMutations: signals.stateMutations,
      visits: signals.visits,
      actions: signals.actions,
      assertions: signals.assertions,
      unsupportedConstructs: signals.unsupportedConstructs,
    });
  }

  return commands;
}

async function parseFeatureFile(file) {
  const text = await readFile(file.absolutePath, "utf8");
  const lines = text.split(/\r?\n/);
  const feature = {
    path: file.path,
    name: null,
    background: {
      steps: [],
      line: null,
    },
    scenarios: [],
  };
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#") || trimmed.startsWith("@")) {
      continue;
    }

    if (trimmed.startsWith("Feature:")) {
      feature.name = trimmed.slice("Feature:".length).trim();
      continue;
    }

    if (trimmed === "Background:" || trimmed.startsWith("Background:")) {
      feature.background.line = index + 1;
      current = feature.background;
      continue;
    }

    const scenarioMatch = trimmed.match(/^Scenario(?: Outline)?:\s*(.+)$/);
    if (scenarioMatch) {
      current = {
        title: scenarioMatch[1].trim(),
        steps: [],
        line: index + 1,
      };
      feature.scenarios.push(current);
      continue;
    }

    if (/^(Given|When|Then|And|But)\b/.test(trimmed) && current != null) {
      current.steps.push(trimmed);
    }
  }

  if (feature.name == null) {
    feature.name = basename(file.path, extname(file.path));
  }

  return feature;
}

async function parseSpecFile(file, { commandsByName, cypressFeatures }) {
  const text = await readFile(file.absolutePath, "utf8");
  const suites = readSuiteTitles(text);
  const setupBlocks = findMochaBlocks(text, "beforeEach", false).concat(findMochaBlocks(text, "before", false));
  const setupSignals = mergeSignals(
    setupBlocks.map((block) => extractSignals(block.body, {
      relativePath: file.path,
      contextKind: block.name,
      testTitle: null,
      commandsByName,
      lineOffset: block.line - 1,
    })),
  );
  const tests = findMochaBlocks(text, "it", true).map((block) => {
    const bodySignals = extractSignals(block.body, {
      relativePath: file.path,
      contextKind: "test",
      testTitle: block.title,
      commandsByName,
      lineOffset: block.line - 1,
    });
    const signals = mergeSignals([setupSignals, bodySignals]);
    const candidateTarget = deriveCandidate({
      suiteTitle: suites[0] ?? basename(file.path, extname(file.path)),
      featureName: basename(file.path).replace(/\.cy\.(js|jsx|ts|tsx|mjs|cjs)$/, ""),
    });
    const relatedFeatureScenarios = relateFeatureScenarios(block.title, cypressFeatures);
    const risks = classifyRisks({
      specPath: file.path,
      testTitle: block.title,
      line: block.line,
      signals,
    });

    return {
      title: block.title,
      fullTitle: [...suites, block.title].join(" > "),
      line: block.line,
      fixtures: signals.fixtures,
      visits: signals.visits,
      stateMutations: signals.stateMutations,
      customCommandUsages: signals.customCommandUsages,
      actions: signals.actions,
      assertions: signals.assertions,
      unsupportedConstructs: signals.unsupportedConstructs,
      risks,
      reviewItems: risks.map((risk) => ({
        type: risk.type,
        message: risk.message,
        suggestion: risk.suggestion,
      })),
      candidateTarget,
      relatedFeatureScenarios,
    };
  });

  return {
    path: file.path,
    suites,
    setup: setupSignals,
    tests,
  };
}

function readSuiteTitles(text) {
  const titles = [];
  const describeRegex = /\bdescribe\s*\(/g;
  let match;
  while ((match = describeRegex.exec(text)) != null) {
    const title = parseFirstString(text, describeRegex.lastIndex);
    if (title != null) {
      titles.push(title.value);
    }
  }
  return unique(titles);
}

function findMochaBlocks(text, name, hasTitle) {
  const blocks = [];
  const regex = new RegExp(`\\b${name}\\s*\\(`, "g");
  let match;

  while ((match = regex.exec(text)) != null) {
    let title = null;
    let searchFrom = regex.lastIndex;
    if (hasTitle) {
      const titleInfo = parseFirstString(text, searchFrom);
      if (titleInfo == null) {
        continue;
      }
      title = titleInfo.value;
      searchFrom = titleInfo.end;
    }

    const body = findArrowBlock(text, searchFrom);
    if (body == null) {
      continue;
    }

    blocks.push({
      name,
      title,
      body: body.body,
      line: countLine(text, match.index),
    });
  }

  return blocks;
}

function extractSignals(source, { relativePath, contextKind, testTitle, commandsByName, lineOffset = 0 }) {
  const fixtures = [];
  const visits = [];
  const stateMutations = [];
  const customCommandUsages = [];
  const actions = [];
  const assertions = [];
  const unsupportedConstructs = [];

  collectFixtureSignals(source, fixtures, lineOffset);
  collectVisitSignals(source, visits, lineOffset);
  collectStateMutations(source, stateMutations, lineOffset);
  collectGetSignals(source, actions, assertions, lineOffset);
  collectContainsSignals(source, actions, assertions, lineOffset);
  collectUrlAssertions(source, assertions, lineOffset);
  collectExpectAssertions(source, assertions, lineOffset);
  collectCustomCommandUsages(source, commandsByName, customCommandUsages, lineOffset);
  collectUnsupportedConstructs(source, unsupportedConstructs, lineOffset);

  const sourceContext = {
    sourcePath: relativePath,
    contextKind,
    testTitle,
  };
  for (const collection of [
    fixtures,
    visits,
    stateMutations,
    customCommandUsages,
    actions,
    assertions,
    unsupportedConstructs,
  ]) {
    for (const entry of collection) {
      entry.source = sourceContext;
    }
  }

  return {
    fixtures: dedupeObjects(fixtures, (fixture) => `${fixture.name}:${fixture.line}`),
    visits: dedupeObjects(visits, (visit) => `${visit.target}:${visit.line}`),
    stateMutations: dedupeObjects(stateMutations, (mutation) => `${mutation.command}:${mutation.line}`),
    customCommandUsages: dedupeObjects(customCommandUsages, (usage) => `${usage.name}:${usage.line}`),
    actions: dedupeObjects(actions, (action) => `${action.command}:${action.selector}:${action.text ?? ""}:${action.line}`),
    assertions: dedupeObjects(assertions, (assertion) => `${assertion.subject}:${assertion.selector ?? ""}:${assertion.expected ?? assertion.expectedExpression ?? ""}:${assertion.line}`),
    unsupportedConstructs: dedupeObjects(unsupportedConstructs, (unsupported) => `${unsupported.command}:${unsupported.line}:${unsupported.detail}`),
  };
}

function collectFixtureSignals(source, fixtures, lineOffset) {
  const regex = /cy\.fixture\s*\(\s*([`"'])(.*?)\1\s*\)/g;
  let match;
  while ((match = regex.exec(source)) != null) {
    fixtures.push({
      name: fixtureName(match[2]),
      rawName: match[2],
      line: lineOffset + countLine(source, match.index),
    });
  }
}

function collectVisitSignals(source, visits, lineOffset) {
  const regex = /cy\.visit\s*\(([^)]*)\)/g;
  let match;
  while ((match = regex.exec(source)) != null) {
    visits.push({
      command: "visit",
      target: cleanExpression(match[1]),
      line: lineOffset + countLine(source, match.index),
    });
  }
}

function collectStateMutations(source, stateMutations, lineOffset) {
  const regex = /cy\.(clearLocalStorage|clearCookies|setCookie|clearCookie)\s*\(/g;
  let match;
  while ((match = regex.exec(source)) != null) {
    stateMutations.push({
      command: match[1],
      line: lineOffset + countLine(source, match.index),
    });
  }
}

function collectGetSignals(source, actions, assertions, lineOffset) {
  const regex = /cy\.get\s*\(([\s\S]*?)\)((?:\s*\.[a-zA-Z]+\s*\([^;\n]*?\))*)/g;
  let match;
  while ((match = regex.exec(source)) != null) {
    const selector = cleanExpression(match[1]);
    const chain = match[2] ?? "";
    const line = lineOffset + countLine(source, match.index);
    collectChainActions({ chain, selector, text: null, line, actions });
    collectChainAssertions({ chain, selector, text: null, line, assertions });
  }
}

function collectContainsSignals(source, actions, assertions, lineOffset) {
  const regex = /cy\.contains\s*\(([\s\S]*?)\)((?:\s*\.[a-zA-Z]+\s*\([^;\n]*?\))*)/g;
  let match;
  while ((match = regex.exec(source)) != null) {
    const args = splitArgs(match[1]);
    const selector = args.length > 1 ? cleanExpression(args[0]) : null;
    const rawText = args.length > 1 ? args[1] : args[0];
    const text = cleanExpression(rawText);
    const textExpression = expressionIfNotLiteral(rawText);
    const chain = match[2] ?? "";
    const line = lineOffset + countLine(source, match.index);
    collectChainActions({ chain, selector, text, line, actions, commandSubject: "contains" });
    collectChainAssertions({ chain, selector, text, textExpression, line, assertions, subject: "contains" });
  }
}

function collectUrlAssertions(source, assertions, lineOffset) {
  const regex = /cy\.(url|location)\s*\(([^)]*)\)?\s*\.should\s*\(([\s\S]*?)\)/g;
  let match;
  while ((match = regex.exec(source)) != null) {
    const args = splitArgs(match[3]);
    assertions.push({
      command: "should",
      subject: match[1],
      assertion: cleanExpression(args[0]),
      expected: args[1] == null ? null : cleanExpression(args[1]),
      line: lineOffset + countLine(source, match.index),
    });
  }
}

function collectExpectAssertions(source, assertions, lineOffset) {
  const regex = /expect\s*\(([\s\S]*?)\)\.([a-zA-Z0-9_.]+)\s*\(([\s\S]*?)\)/g;
  let match;
  while ((match = regex.exec(source)) != null) {
    assertions.push({
      command: "expect",
      subject: cleanExpression(match[1]),
      assertion: match[2],
      expected: cleanExpression(match[3]),
      line: lineOffset + countLine(source, match.index),
    });
  }
}

function collectCustomCommandUsages(source, commandsByName, customCommandUsages, lineOffset) {
  for (const name of commandsByName.keys()) {
    const regex = new RegExp(`cy\\.${escapeRegExp(name)}\\s*\\(([^)]*)\\)`, "g");
    let match;
    while ((match = regex.exec(source)) != null) {
      customCommandUsages.push({
        name,
        arguments: splitArgs(match[1]).map(cleanExpression),
        line: lineOffset + countLine(source, match.index),
      });
    }
  }
}

function collectUnsupportedConstructs(source, unsupportedConstructs, lineOffset) {
  const unsupportedPatterns = [
    {
      regex: /cy\.intercept\s*\(([\s\S]*?)\)/g,
      command: "cy.intercept",
      type: "mock-heavy",
      suggestion: "Review mock-heavy Cypress intercepts; prefer real backend coverage or explicit Playwright routing only when the mock is intentional.",
    },
    {
      regex: /cy\.session\s*\(([\s\S]*?)\)/g,
      command: "cy.session",
      type: "session",
      suggestion: "Design an explicit Java auth helper or UI Background before replacing Cypress session state.",
    },
    {
      regex: /cy\.task\s*\(([\s\S]*?)\)/g,
      command: "cy.task",
      type: "plugin-task",
      suggestion: "Review Cypress plugin task usage and replace it with an explicit Java helper only when required for setup.",
    },
    {
      regex: /cy\.origin\s*\(([\s\S]*?)\)/g,
      command: "cy.origin",
      type: "cross-origin",
      suggestion: "Review cross-origin flow boundaries and configure Playwright context/navigation intentionally.",
    },
  ];

  for (const pattern of unsupportedPatterns) {
    let match;
    while ((match = pattern.regex.exec(source)) != null) {
      unsupportedConstructs.push({
        command: pattern.command,
        type: pattern.type,
        detail: cleanExpression(match[1]),
        suggestion: pattern.suggestion,
        line: lineOffset + countLine(source, match.index),
      });
    }
  }

  const waitRegex = /cy\.wait\s*\(([\s\S]*?)\)/g;
  let waitMatch;
  while ((waitMatch = waitRegex.exec(source)) != null) {
    const detail = cleanExpression(waitMatch[1]);
    const numeric = /^\d+$/.test(detail);
    unsupportedConstructs.push({
      command: "cy.wait",
      type: numeric ? "timing-dependent" : "alias",
      detail,
      suggestion: numeric
        ? "Replace numeric waits with Playwright locator, URL, or business-state assertions."
        : "Review aliased waits and migrate only behavior-relevant network outcomes.",
      line: lineOffset + countLine(source, waitMatch.index),
    });
  }

  const aliasRegex = /\.as\s*\(([\s\S]*?)\)/g;
  let aliasMatch;
  while ((aliasMatch = aliasRegex.exec(source)) != null) {
    unsupportedConstructs.push({
      command: ".as",
      type: "alias",
      detail: cleanExpression(aliasMatch[1]),
      suggestion: "Review Cypress aliases and replace them with explicit local variables or Playwright waits where behavior-relevant.",
      line: lineOffset + countLine(source, aliasMatch.index),
    });
  }

  const requestRegex = /cy\.request\s*\(([\s\S]*?)\)/g;
  let requestMatch;
  while ((requestMatch = requestRegex.exec(source)) != null) {
    const detail = cleanExpression(requestMatch[1]);
    unsupportedConstructs.push({
      command: "cy.request",
      type: /POST|PUT|PATCH|DELETE/i.test(detail) ? "write/shared-data" : "api-request",
      detail,
      suggestion: "Design explicit API setup/teardown helpers and data isolation before migrating request-backed setup.",
      line: lineOffset + countLine(source, requestMatch.index),
    });
  }
}

function collectChainActions({ chain, selector, text, line, actions, commandSubject = "get" }) {
  for (const command of ["clear", "click", "select", "check", "uncheck"]) {
    if (new RegExp(`\\.${command}\\s*\\(`).test(chain)) {
      actions.push({
        command,
        subject: commandSubject,
        selector,
        text,
        line,
      });
    }
  }

  const typeMatch = chain.match(/\.type\s*\(([\s\S]*?)\)/);
  if (typeMatch) {
    actions.push({
      command: "type",
      subject: commandSubject,
      selector,
      text,
      valueExpression: cleanExpression(typeMatch[1]),
      line,
    });
  }
}

function collectChainAssertions({ chain, selector, text, textExpression = null, line, assertions, subject = "get" }) {
  const shouldRegex = /\.should\s*\(([\s\S]*?)\)/g;
  let match;
  while ((match = shouldRegex.exec(chain)) != null) {
    const args = splitArgs(match[1]);
    assertions.push({
      command: "should",
      subject,
      selector,
      text,
      assertion: cleanExpression(args[0]),
      expected: args[1] == null ? text : cleanExpression(args[1]),
      expectedExpression: args[1] == null ? textExpression : expressionIfNotLiteral(args[1]),
      line,
    });
  }
}

function classifyRisks({ specPath, testTitle, line, signals }) {
  const risks = [];
  const context = { specPath, testTitle, line };

  for (const usage of signals.customCommandUsages) {
    risks.push({
      type: "hidden-setup",
      severity: "high",
      context: { ...context, line: usage.line, commandName: usage.name },
      message: `Custom command ${usage.name} hides setup or UI behavior that must be reviewed before migration.`,
      suggestion: `Review Cypress command ${usage.name} and convert required behavior into a Background, auth helper, or interaction module.`,
    });
  }

  if (signals.fixtures.length > 0) {
    risks.push({
      type: "fixture-data",
      severity: "medium",
      context,
      message: `Fixture-backed data used: ${unique(signals.fixtures.map((fixture) => fixture.name)).join(", ")}.`,
      suggestion: "Review fixture contents for sensitive values; map small read-only data to examples or Java test-data helpers.",
    });
  }

  for (const signal of signals.unsupportedConstructs) {
    risks.push({
      type: signal.type,
      severity: unsupportedSeverity(signal.type),
      context: { ...context, line: signal.line },
      message: `${signal.command} requires migration review: ${signal.detail}.`,
      suggestion: signal.suggestion,
    });
  }

  for (const action of signals.actions) {
    if (action.selector != null && isBrittleSelector(action.selector)) {
      risks.push({
        type: "brittle-selector",
        severity: "medium",
        context: { ...context, line: action.line },
        message: `Selector ${action.selector} may be brittle outside Cypress.`,
        suggestion: "Prefer role, label, text, or stable test-id Playwright locators during migration review.",
      });
    }
  }

  for (const assertion of signals.assertions) {
    if (assertion.selector != null && isBrittleSelector(assertion.selector)) {
      risks.push({
        type: "brittle-selector",
        severity: "medium",
        context: { ...context, line: assertion.line },
        message: `Assertion selector ${assertion.selector} may be brittle outside Cypress.`,
        suggestion: "Prefer role, label, text, or stable test-id Playwright locators during migration review.",
      });
    }
  }

  return dedupeObjects(risks, (risk) => `${risk.type}:${risk.context.line}:${risk.message}`);
}

function unsupportedSeverity(type) {
  if (type === "mock-heavy" || type === "session" || type === "write/shared-data") {
    return "high";
  }
  if (type === "timing-dependent" || type === "alias") {
    return "medium";
  }
  return "medium";
}

function isBrittleSelector(selector) {
  return !selector.includes("data-testid") && !selector.includes("data-cy") && !selector.startsWith("@");
}

function mergeSignals(signalSets) {
  return {
    fixtures: dedupeObjects(signalSets.flatMap((signals) => signals.fixtures), (fixture) => `${fixture.name}:${fixture.line}`),
    visits: dedupeObjects(signalSets.flatMap((signals) => signals.visits), (visit) => `${visit.target}:${visit.line}`),
    stateMutations: dedupeObjects(signalSets.flatMap((signals) => signals.stateMutations), (mutation) => `${mutation.command}:${mutation.line}`),
    customCommandUsages: dedupeObjects(signalSets.flatMap((signals) => signals.customCommandUsages), (usage) => `${usage.name}:${usage.line}`),
    actions: dedupeObjects(signalSets.flatMap((signals) => signals.actions), (action) => `${action.command}:${action.selector}:${action.text ?? ""}:${action.line}`),
    assertions: dedupeObjects(signalSets.flatMap((signals) => signals.assertions), (assertion) => `${assertion.subject}:${assertion.selector ?? ""}:${assertion.expected ?? assertion.expectedExpression ?? ""}:${assertion.line}`),
    unsupportedConstructs: dedupeObjects(signalSets.flatMap((signals) => signals.unsupportedConstructs), (unsupported) => `${unsupported.command}:${unsupported.line}:${unsupported.detail}`),
  };
}

function deriveCandidate({ suiteTitle, featureName }) {
  const feature = slug(featureName);
  const suite = slug(suiteTitle);
  let areaPart = suite;

  if (feature && suite.endsWith(`-${feature}`)) {
    areaPart = suite.slice(0, -feature.length - 1);
  } else if (feature && suite.startsWith(`${feature}-`)) {
    areaPart = suite.slice(feature.length + 1);
  }

  const area = compactSlug(areaPart || dirname(featureName).split("/").pop() || feature || "migration");
  return {
    area,
    feature,
    featurePath: `features/${area}/${feature}.feature`,
  };
}

function relateFeatureScenarios(testTitle, cypressFeatures) {
  const normalizedTest = slug(testTitle);
  return cypressFeatures
    .flatMap((feature) =>
      feature.scenarios.map((scenario) => ({
        path: feature.path,
        feature: feature.name,
        title: scenario.title,
        line: scenario.line,
        steps: scenario.steps,
      })),
    )
    .filter((scenario) => {
      const normalizedScenario = slug(scenario.title);
      return normalizedScenario.includes(normalizedTest) || normalizedTest.includes(normalizedScenario);
    });
}

function readObjectProperty(text, name) {
  const regex = new RegExp(`${escapeRegExp(name)}\\s*:\\s*([\\\`"'])(.*?)\\1`);
  const match = text.match(regex);
  return match == null ? null : match[2];
}

function parseFirstString(text, fromIndex) {
  let index = fromIndex;
  while (index < text.length && /[\s,]/.test(text[index])) {
    index += 1;
  }
  const quote = text[index];
  if (!["'", "\"", "`"].includes(quote)) {
    return null;
  }
  index += 1;
  let value = "";
  while (index < text.length) {
    const char = text[index];
    if (char === "\\") {
      value += text.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === quote) {
      return { value, end: index + 1 };
    }
    value += char;
    index += 1;
  }
  return null;
}

function findArrowBlock(text, fromIndex) {
  const arrowIndex = text.indexOf("=>", fromIndex);
  const functionIndex = text.indexOf("function", fromIndex);
  let searchFrom = fromIndex;
  if (arrowIndex !== -1 && (functionIndex === -1 || arrowIndex < functionIndex)) {
    searchFrom = arrowIndex + 2;
  } else if (functionIndex !== -1) {
    searchFrom = functionIndex + "function".length;
  }

  const openIndex = text.indexOf("{", searchFrom);
  if (openIndex === -1) {
    return null;
  }
  return findBalancedBlock(text, openIndex);
}

function findBalancedBlock(text, openIndex) {
  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote != null) {
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          openIndex,
          closeIndex: index,
          body: text.slice(openIndex + 1, index),
        };
      }
    }
  }

  return null;
}

function splitArgs(argsText) {
  const args = [];
  let current = "";
  let quote = null;
  let depth = 0;

  for (let index = 0; index < argsText.length; index += 1) {
    const char = argsText[index];
    if (quote != null) {
      current += char;
      if (char === "\\") {
        index += 1;
        current += argsText[index] ?? "";
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim().length > 0) {
    args.push(current.trim());
  }

  return args;
}

function cleanExpression(expression) {
  const trimmed = String(expression ?? "").trim();
  if (trimmed.length >= 2 && ["'", "\"", "`"].includes(trimmed[0]) && trimmed[trimmed.length - 1] === trimmed[0]) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\$\{([^}]+)\}/g, "${$1}");
}

function expressionIfNotLiteral(expression) {
  const trimmed = String(expression ?? "").trim();
  return ["'", "\"", "`"].includes(trimmed[0]) ? null : cleanExpression(trimmed);
}

function fixtureName(rawName) {
  return rawName.replace(/\.(json|js|ts)$/i, "");
}

function dedupeObjects(values, keyFn) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
