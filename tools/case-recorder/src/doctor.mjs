import path from "node:path";
import { fileURLToPath } from "node:url";
import { optionalOption, parseArgs } from "./args.mjs";
import { formatPreflightResult, runPreflight } from "./preflight.mjs";

const options = parseArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, "../../..");
const repoRoot = path.resolve(optionalOption(options, "repo-root", defaultRepoRoot));
const result = runPreflight({ repoRoot });

process.stdout.write(formatPreflightResult(result));
process.exit(result.ok ? 0 : 1);
