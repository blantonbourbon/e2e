import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { booleanOption, optionalOption, parseArgs, requireOption } from "./args.mjs";
import { gherkinString, humanize, javaString, toPascalCase, validateJavaPackageSegment, validateSlug } from "./names.mjs";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = requireOption(options, "repo-root");
  const draftDir = requireOption(options, "draft-dir");
  const area = requireOption(options, "area");
  const feature = requireOption(options, "feature");
  const force = booleanOption(options, "force");

  validateJavaPackageSegment(area, "area");
  validateSlug(feature, "feature");

  const metadata = await readMetadata(draftDir);
  const scenario = optionalOption(options, "scenario", metadata.scenario ?? humanize(feature));
  const baseUrl = optionalOption(options, "base-url", metadata.baseUrl);
  const recordingPath = path.join(draftDir, metadata.recording ?? "recording.java");
  const recording = await readFile(recordingPath, "utf8");
  const statements = extractRecordedStatements(recording);
  const conversion = convertStatements(statements, metadata.path ?? "/", baseUrl);

  const featurePath = path.join(
    repoRoot,
    "test-suite",
    "src",
    "test",
    "resources",
    "features",
    area,
    `${feature}.feature`
  );
  const stepsPath = path.join(
    repoRoot,
    "test-suite",
    "src",
    "test",
    "java",
    "com",
    "example",
    "e2e",
    "tests",
    "steps",
    area,
    `${toPascalCase(feature)}Steps.java`
  );

  guardWritable(featurePath, force);
  guardWritable(stepsPath, force);

  await mkdir(path.dirname(featurePath), { recursive: true });
  await mkdir(path.dirname(stepsPath), { recursive: true });
  await writeFile(featurePath, renderFeature(area, feature, scenario, conversion.steps), "utf8");
  await writeFile(stepsPath, renderSteps(area, feature, conversion.unsupported), "utf8");

  console.log(`Generated ${featurePath}`);
  console.log(`Generated ${stepsPath}`);
  if (conversion.unsupported.length > 0) {
    console.log(`${conversion.unsupported.length} recorded action(s) need manual step implementation.`);
  }
}

async function readMetadata(draftDir) {
  const metadataPath = path.join(draftDir, "metadata.json");
  if (!existsSync(metadataPath)) {
    return {};
  }
  return JSON.parse(await readFile(metadataPath, "utf8"));
}

function guardWritable(filePath, force) {
  if (existsSync(filePath) && !force) {
    throw new Error(`Refusing to overwrite existing file without --force: ${filePath}`);
  }
}

function extractRecordedStatements(source) {
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

function convertStatements(statements, fallbackPath, baseUrl) {
  const steps = [];
  const unsupported = [];
  let firstStep = true;

  for (const statement of statements) {
    const converted = convertStatement(statement, fallbackPath, baseUrl, firstStep);
    firstStep = false;
    if (converted.supported) {
      steps.push(converted.text);
    } else {
      const actionNumber = unsupported.length + 1;
      const text = `When the user performs generated action ${actionNumber}`;
      steps.push(text);
      unsupported.push({ actionNumber, statement });
    }
  }

  if (steps.length === 0 && fallbackPath) {
    steps.push(`Given the user opens the relative path "${gherkinString(fallbackPath)}"`);
  }

  return { steps, unsupported };
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

function renderFeature(area, feature, scenario, steps) {
  const lines = [
    `@${area} @draft`,
    `Feature: ${humanize(feature)}`,
    "",
    `  Scenario: ${scenario}`,
    ...steps.map((step) => `    ${step}`)
  ];
  return `${lines.join("\n")}\n`;
}

function renderSteps(area, feature, unsupported) {
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

function renderUnsupportedStep(action) {
  const methodName = `theUserPerformsGeneratedAction${action.actionNumber}`;
  const rawAction = javaString(action.statement.replace(/\s+/g, " "));
  return `    @When("the user performs generated action ${action.actionNumber}")\n` +
    `    public void ${methodName}() {\n` +
    `        throw new UnsupportedOperationException("Review generated action ${action.actionNumber} before running this scenario. Raw action: ${rawAction}");\n` +
    "    }\n";
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
