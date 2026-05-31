export function renderRunner(areaName, runnerClassName) {
  return `package com.example.e2e.tests.runner.${areaName};

import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/${areaName}")
public class ${runnerClassName} {
}
`;
}

export function formatScaffoldSummary(plan, { dryRun = false } = {}) {
  const lines = [];

  if (plan.area.existing) {
    lines.push(`${dryRun ? "Would reuse" : "Reused"} registered area ${plan.area.name} (${plan.area.taskName}).`);
  } else {
    lines.push(`${dryRun ? "Would create" : "Created"} area scaffold ${plan.area.name} (${plan.area.taskName}).`);
  }

  for (const operation of plan.operations) {
    if (operation.status === "conflict") {
      lines.push(`Conflict ${operation.filePath}`);
    } else if (operation.kind === "gradle-registration") {
      lines.push(`${dryRun ? "Would update" : "Updated"} ${operation.filePath}`);
    } else if (!operation.source) {
      lines.push(`${dryRun ? "Would generate" : "Generated"} ${operation.filePath}`);
    } else if (operation.status === "overwrite") {
      lines.push(`${dryRun ? "Would update" : "Updated"} ${operation.filePath}`);
    } else {
      lines.push(`${dryRun ? "Would generate" : "Generated"} ${operation.filePath}`);
    }
  }

  lines.push(`Resolved URL: ${plan.target.resolvedUrl}`);
  if (plan.draft.unsupportedActions.length > 0) {
    lines.push(`${plan.draft.unsupportedActions.length} recorded action(s) need manual step implementation.`);
  }
  lines.push("Review work:");
  for (const item of plan.metadata.reviewWork) {
    lines.push(`- ${item}`);
  }
  lines.push(`Next validation command: ${plan.nextValidationCommand}`);

  return `${lines.join("\n")}\n`;
}
