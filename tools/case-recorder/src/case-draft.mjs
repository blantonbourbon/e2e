import { gherkinString, humanize, javaString, toPascalCase } from "./names.mjs";

export function generateCaseDraft(recording, options) {
  const feature = requiredText(options.feature, "feature");
  const area = requiredText(options.area, "area");
  const scenario = textOr(options.scenario, humanize(feature));
  const fallbackPath = textOr(options.path, "/");
  const baseUrl = textOr(options.baseUrl);
  const resolvedUrl = textOr(options.resolvedUrl);
  const statements = extractRecordedStatements(recording);
  const conversion = convertStatements(statements, fallbackPath, baseUrl);
  const draft = {
    area,
    feature,
    scenario,
    baseUrl,
    path: fallbackPath,
    resolvedUrl,
    steps: conversion.steps,
    unsupportedActions: conversion.unsupported,
    actionInventory: conversion.actionInventory
  };

  return {
    ...draft,
    files: {
      feature: renderFeature(area, feature, scenario, conversion.steps),
      steps: renderSteps(area, feature, conversion.unsupported),
      draftPack: renderDraftPack(draft),
      summary: renderDraftSummary(draft)
    }
  };
}

export function extractRecordedStatements(source) {
  const statements = [];
  const lines = source.split(/\r?\n/);
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (current.length === 0) {
      if (trimmed.startsWith("page.") || trimmed.startsWith("assertThat(")) {
        current.push(trimmed);
      }
    } else {
      current.push(trimmed);
    }

    if (current.length > 0 && trimmed.endsWith(";")) {
      statements.push(current.join("\n"));
      current = [];
    }
  }

  return statements;
}

export function renderFeature(area, feature, scenario, steps) {
  const lines = [
    `@${area} @draft`,
    `Feature: ${humanize(feature)}`,
    "",
    `  Scenario: ${scenario}`,
    ...steps.map((step) => `    ${step}`)
  ];
  return `${lines.join("\n")}\n`;
}

export function renderSteps(area, feature, unsupported) {
  const className = `${toPascalCase(feature)}Steps`;
  const body = unsupported.length > 0
    ? unsupported.map(renderUnsupportedStep).join("\n\n")
    : "    // Supported recorded actions are covered by common draft interaction steps.\n";
  const sections = [`package com.example.e2e.tests.steps.${area};`];

  if (unsupported.length > 0) {
    sections.push("import io.cucumber.java.en.When;");
  }

  sections.push(`public class ${className} {\n${body}}`);
  return `${sections.join("\n\n")}\n`;
}

export function renderDraftPack(draft) {
  const pack = {
    area: draft.area,
    feature: draft.feature,
    scenario: draft.scenario,
    baseUrl: draft.baseUrl,
    path: draft.path,
    resolvedUrl: draft.resolvedUrl,
    steps: draft.steps,
    unsupportedActions: draft.unsupportedActions,
    actionInventory: draft.actionInventory,
    generatedFiles: draft.generatedFiles,
    reviewWork: draft.reviewWork,
    nextValidationCommand: draft.nextValidationCommand
  };
  return `${JSON.stringify(removeUndefined(pack), null, 2)}\n`;
}

export function renderDraftSummary(draft) {
  const lines = [
    `# ${humanize(draft.feature)} Draft`,
    "",
    `- Area: ${draft.area}`,
    `- Scenario: ${draft.scenario}`,
    ...(draft.baseUrl ? [`- Base URL: ${draft.baseUrl}`] : []),
    ...(draft.path ? [`- Path: ${draft.path}`] : []),
    ...(draft.resolvedUrl ? [`- Resolved URL: ${draft.resolvedUrl}`] : []),
    `- Supported actions: ${draft.actionInventory.filter(action => action.supported).length}`,
    `- Unsupported actions: ${draft.unsupportedActions.length}`,
    "",
    "## Generated Steps",
    "",
    ...draft.steps.map(step => `- ${step}`)
  ];

  if (draft.unsupportedActions.length > 0) {
    lines.push("", "## Unsupported Actions", "");
    for (const action of draft.unsupportedActions) {
      lines.push(`- ${action.actionNumber}: \`${action.statement.replace(/`/g, "\\`")}\``);
    }
  }

  if (draft.generatedFiles?.length > 0) {
    lines.push("", "## Generated Files", "");
    for (const filePath of draft.generatedFiles) {
      lines.push(`- ${filePath}`);
    }
  }

  if (draft.reviewWork?.length > 0) {
    lines.push("", "## Review Work", "");
    for (const item of draft.reviewWork) {
      lines.push(`- ${item}`);
    }
  }

  if (draft.nextValidationCommand) {
    lines.push("", "## Next Validation", "", `Next validation command: \`${draft.nextValidationCommand}\``);
  }

  return `${lines.join("\n")}\n`;
}

function convertStatements(statements, fallbackPath, baseUrl) {
  const steps = [];
  const unsupported = [];
  const actionInventory = [];
  let firstStep = true;

  for (const statement of statements) {
    const converted = convertStatement(statement, fallbackPath, baseUrl, firstStep);
    firstStep = false;

    if (converted.supported) {
      steps.push(converted.text);
      actionInventory.push({
        actionNumber: actionInventory.length + 1,
        supported: true,
        statement,
        step: converted.text
      });
    } else {
      const actionNumber = unsupported.length + 1;
      const text = `When the user performs generated action ${actionNumber}`;
      steps.push(text);
      unsupported.push({ actionNumber, statement });
      actionInventory.push({
        actionNumber: actionInventory.length + 1,
        supported: false,
        unsupportedActionNumber: actionNumber,
        statement,
        step: text
      });
    }
  }

  if (steps.length === 0 && fallbackPath) {
    const fallbackStep = `Given the user opens the relative path "${gherkinString(fallbackPath)}"`;
    steps.push(fallbackStep);
    actionInventory.push({
      actionNumber: 1,
      supported: true,
      statement: null,
      step: fallbackStep,
      source: "fallback-path"
    });
  }

  return { steps, unsupported, actionInventory };
}

function convertStatement(statement, fallbackPath, baseUrl, firstStep) {
  const navigate = matchOne(statement, /^page\.navigate\("((?:\\.|[^"\\])*)"\);$/s);
  if (navigate) {
    const pathValue = toRelativePath(unescapeJavaString(navigate[1]), baseUrl) ?? fallbackPath;
    return {
      supported: true,
      text: `${firstStep ? "Given" : "And"} the user opens the relative path "${gherkinString(pathValue)}"`
    };
  }

  const roleClick = matchOne(
    statement,
    /^page\.getByRole\(AriaRole\.([A-Z_]+),\s*new Page\.GetByRoleOptions\(\)\.setName\("((?:\\.|[^"\\])*)"\)(?:\.[^)]+)?\)\.click\(\);$/s
  );
  if (roleClick) {
    return {
      supported: true,
      text: `When the user clicks the ${roleName(roleClick[1])} named "${gherkinString(unescapeJavaString(roleClick[2]))}"`
    };
  }

  const textClick = matchOne(
    statement,
    /^page\.getByText\("((?:\\.|[^"\\])*)"\)(?:\.first\(\))?\.click\(\);$/s
  );
  if (textClick) {
    return {
      supported: true,
      text: `When the user clicks the text "${gherkinString(unescapeJavaString(textClick[1]))}"`
    };
  }

  const selectorClick = matchOne(
    statement,
    /^page\.locator\("((?:\\.|[^"\\])*)"\)(?:\.first\(\))?\.click\(\);$/s
  );
  if (selectorClick) {
    return {
      supported: true,
      text: `When the user clicks selector "${gherkinString(unescapeJavaString(selectorClick[1]))}"`
    };
  }

  const labelFill = matchOne(
    statement,
    /^page\.getByLabel\("((?:\\.|[^"\\])*)"\)\.fill\("((?:\\.|[^"\\])*)"\);$/s
  );
  if (labelFill) {
    return {
      supported: true,
      text: `When the user fills the field labeled "${gherkinString(unescapeJavaString(labelFill[1]))}" with "${gherkinString(unescapeJavaString(labelFill[2]))}"`
    };
  }

  const placeholderFill = matchOne(
    statement,
    /^page\.getByPlaceholder\("((?:\\.|[^"\\])*)"\)\.fill\("((?:\\.|[^"\\])*)"\);$/s
  );
  if (placeholderFill) {
    return {
      supported: true,
      text: `When the user fills the field with placeholder "${gherkinString(unescapeJavaString(placeholderFill[1]))}" with "${gherkinString(unescapeJavaString(placeholderFill[2]))}"`
    };
  }

  const selectorFill = matchOne(
    statement,
    /^page\.locator\("((?:\\.|[^"\\])*)"\)\.fill\("((?:\\.|[^"\\])*)"\);$/s
  );
  if (selectorFill) {
    return {
      supported: true,
      text: `When the user fills selector "${gherkinString(unescapeJavaString(selectorFill[1]))}" with "${gherkinString(unescapeJavaString(selectorFill[2]))}"`
    };
  }

  const titleContains = matchOne(
    statement,
    /^assertThat\(page\)\.hasTitle\(Pattern\.compile\("\.\*((?:\\.|[^"\\])*)\.\*"\)\);$/s
  );
  if (titleContains) {
    return {
      supported: true,
      text: `Then the page title should contain "${gherkinString(unescapeJavaString(titleContains[1]))}"`
    };
  }

  const titleExact = matchOne(
    statement,
    /^assertThat\(page\)\.hasTitle\("((?:\\.|[^"\\])*)"\);$/s
  );
  if (titleExact) {
    return {
      supported: true,
      text: `Then the page title should contain "${gherkinString(unescapeJavaString(titleExact[1]))}"`
    };
  }

  const roleVisible = matchOne(
    statement,
    /^assertThat\(page\.getByRole\(AriaRole\.([A-Z_]+),\s*new Page\.GetByRoleOptions\(\)\.setName\("((?:\\.|[^"\\])*)"\)(?:\.[^)]+)?\)\)\.isVisible\(\);$/s
  );
  if (roleVisible) {
    return {
      supported: true,
      text: `Then the ${roleName(roleVisible[1])} named "${gherkinString(unescapeJavaString(roleVisible[2]))}" should be visible`
    };
  }

  const textVisible = matchOne(
    statement,
    /^assertThat\(page\.getByText\("((?:\\.|[^"\\])*)"\)(?:\.first\(\))?\)\.isVisible\(\);$/s
  );
  if (textVisible) {
    return {
      supported: true,
      text: `Then the text "${gherkinString(unescapeJavaString(textVisible[1]))}" should be visible`
    };
  }

  const selectorVisible = matchOne(
    statement,
    /^assertThat\(page\.locator\("((?:\\.|[^"\\])*)"\)(?:\.first\(\))?\)\.isVisible\(\);$/s
  );
  if (selectorVisible) {
    return {
      supported: true,
      text: `Then selector "${gherkinString(unescapeJavaString(selectorVisible[1]))}" should be visible`
    };
  }

  return { supported: false };
}

function renderUnsupportedStep(action) {
  const methodName = `theUserPerformsGeneratedAction${action.actionNumber}`;
  const rawAction = javaString(action.statement.replace(/\s+/g, " "));
  return `    @When("the user performs generated action ${action.actionNumber}")\n` +
    `    public void ${methodName}() {\n` +
    `        throw new UnsupportedOperationException("Review generated action ${action.actionNumber} before running this scenario. Raw action: ${rawAction}");\n` +
    "    }\n";
}

function matchOne(value, regex) {
  return value.match(regex);
}

function roleName(role) {
  return role.toLowerCase().replace(/_/g, "-");
}

function toRelativePath(url, baseUrl) {
  if (!baseUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const parsedBaseUrl = new URL(baseUrl);
    if (parsedUrl.origin !== parsedBaseUrl.origin) {
      return null;
    }
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || "/";
  } catch {
    return url.startsWith("/") ? url : null;
  }
}

function unescapeJavaString(value) {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function requiredText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required ${label}`);
  }
  return value.trim();
}

function textOr(value, fallback = undefined) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([_key, entryValue]) => entryValue !== undefined)
  );
}
