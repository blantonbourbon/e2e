import { toPascalCase } from "./names.mjs";

const DEFAULT_BASE_URL = "https://playwright.dev";

export function createAreaConfig({ areaName, taskSuffix, baseUrl, explorePath, testIdAttribute }) {
  const runnerClassName = `${taskSuffix}RunCucumberTest`;
  return {
    name: areaName,
    existing: false,
    taskName: `test${taskSuffix}`,
    taskSuffix,
    baseUrl,
    runnerClassName,
    runnerFqn: `com.example.e2e.tests.runner.${areaName}.${runnerClassName}`,
    glue: [
      "com.example.e2e.core.hooks",
      "com.example.e2e.tests.steps.common",
      `com.example.e2e.tests.steps.${areaName}`
    ],
    parallelEnabled: false,
    parallelism: 1,
    explore: {
      enabled: true,
      path: explorePath,
      testIdAttribute
    }
  };
}

export function findRegisteredArea(contents, areaName) {
  const block = findCucumberAreasBlock(contents);
  const blockContents = contents.slice(block.openIndex + 1, block.closeIndex);
  const match = new RegExp(`(^|\\n)[ \\t]*${escapeRegex(areaName)}\\s*:\\s*\\[`).exec(blockContents);
  if (!match) {
    return null;
  }

  const entryStart = block.openIndex + 1 + match.index + match[1].length;
  const entryOpen = contents.indexOf("[", entryStart);
  const entryClose = findMatchingBracket(contents, entryOpen);
  const entry = contents.slice(entryStart, entryClose + 1);
  const taskSuffix = readGroovyStringField(entry, "taskSuffix") ?? toPascalCase(areaName);
  const taskName = readGroovyStringField(entry, "taskName") ?? `test${taskSuffix}`;
  const runnerFqn = readGroovyStringField(entry, "runnerClassName") ??
    `com.example.e2e.tests.runner.${areaName}.${taskSuffix}RunCucumberTest`;
  const runnerClassName = runnerFqn.split(".").at(-1);

  return {
    name: areaName,
    existing: true,
    taskName,
    taskSuffix,
    baseUrl: readGroovyStringField(entry, "baseUrl") ?? DEFAULT_BASE_URL,
    runnerClassName,
    runnerFqn,
    glue: readGlue(entry),
    parallelEnabled: /parallelEnabled\s*:\s*true/.test(entry),
    parallelism: Number.parseInt(entry.match(/parallelism\s*:\s*(\d+)/)?.[1] ?? "1", 10)
  };
}

export function renderUpdatedBuildGradle(contents, areaName, area) {
  const block = findCucumberAreasBlock(contents);
  if (findRegisteredArea(contents, areaName)) {
    throw new Error(`Area '${areaName}' is already registered in cucumberAreas`);
  }

  const beforeClosingBracket = contents.slice(0, block.closeIndex).replace(/\s*$/, "");
  return `${beforeClosingBracket},\n${renderGradleAreaEntry(areaName, area)}\n${contents.slice(block.closeIndex)}`;
}

function renderGradleAreaEntry(areaName, area) {
  return `        ${areaName}: [
                taskName       : ${groovyString(area.taskName)},
                taskSuffix     : ${groovyString(area.taskSuffix)},
                baseUrl        : ${groovyString(area.baseUrl)},
                runnerClassName: ${groovyString(area.runnerFqn)},
                glue           : [
                        'com.example.e2e.core.hooks',
                        'com.example.e2e.tests.steps.common',
                        ${groovyString(`com.example.e2e.tests.steps.${areaName}`)}
                ],
                parallelEnabled: false,
                parallelism    : 1,
                explore        : [
                        enabled        : true,
                        path           : ${groovyString(area.explore.path)},
                        testIdAttribute: ${groovyString(area.explore.testIdAttribute)}
                ]
        ]`;
}

function findCucumberAreasBlock(contents) {
  const declarationIndex = contents.indexOf("def cucumberAreas = [");
  if (declarationIndex < 0) {
    throw new Error("Unable to find def cucumberAreas = [...] in test-suite/build.gradle");
  }

  const openIndex = contents.indexOf("[", declarationIndex);
  const closeIndex = findMatchingBracket(contents, openIndex);
  return { openIndex, closeIndex };
}

function findMatchingBracket(contents, openIndex) {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaping = false;

  for (let index = openIndex; index < contents.length; index += 1) {
    const char = contents[index];

    if (escaping) {
      escaping = false;
      continue;
    }
    if ((inSingleQuote || inDoubleQuote) && char === "\\") {
      escaping = true;
      continue;
    }
    if (!inDoubleQuote && char === "'") {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (!inSingleQuote && char === "\"") {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) {
      continue;
    }

    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error("Unable to find matching ] for cucumberAreas block");
}

function readGroovyStringField(entry, fieldName) {
  const match = new RegExp(`${fieldName}\\s*:\\s*'((?:\\\\.|[^'\\\\])*)'`).exec(entry);
  return match ? unescapeGroovyString(match[1]) : null;
}

function readGlue(entry) {
  const glueMatch = /glue\s*:\s*\[([\s\S]*?)\n\s*]/.exec(entry);
  if (!glueMatch) {
    return [];
  }
  return Array.from(glueMatch[1].matchAll(/'((?:\\.|[^'\\])*)'/g), (match) => unescapeGroovyString(match[1]));
}

function groovyString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function unescapeGroovyString(value) {
  return value.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
