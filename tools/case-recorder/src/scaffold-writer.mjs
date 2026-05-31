import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatScaffoldSummary } from "./scaffold-render.mjs";

export async function applyScaffoldPlan(plan, { dryRun = false } = {}) {
  if (dryRun) {
    return {
      written: [],
      summary: formatScaffoldSummary(plan, { dryRun: true })
    };
  }

  if (plan.conflicts.length > 0) {
    const details = plan.conflicts
      .map((operation) => {
        const reason = operation.reason ? ` - ${operation.reason}` : "";
        const guidance = operation.guidance ? ` ${operation.guidance}` : "";
        return `${operation.kind}: ${operation.filePath}${reason}${guidance}`;
      })
      .join("\n");
    throw new Error(`Refusing to write scaffold with conflicts:\n${details}`);
  }

  const summary = formatScaffoldSummary(plan);
  const written = [];

  for (const operation of plan.operations) {
    if (operation.status === "skip") {
      continue;
    }
    await mkdir(path.dirname(operation.filePath), { recursive: true });
    const contents = operation.kind === "metadata"
      ? `${JSON.stringify({
        ...plan.metadata,
        terminalSummary: summary.trim()
      }, null, 2)}\n`
      : ensureTrailingNewline(operation.contents);
    await writeFile(operation.filePath, contents, "utf8");
    written.push(operation);
  }

  return { written, summary };
}

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}
