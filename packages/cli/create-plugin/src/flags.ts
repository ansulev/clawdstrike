/**
 * Non-interactive flag parsing for the create-plugin CLI.
 *
 * Parses process.argv for --name, --type, --contributions, --publisher, --pm,
 * and --non-interactive flags. Returns null if required flags are missing.
 */

import path from "node:path";
import type { ScaffoldOptions, PluginType, ContributionPoint } from "./types";
import { PLUGIN_TYPES, CONTRIBUTION_POINTS, PLUGIN_TYPE_DEFAULTS } from "./types";

/** Regex for validating kebab-case plugin names. */
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Derive a display name from a kebab-case name.
 * E.g., "my-guard" -> "My Guard"
 */
function toDisplayName(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Extract a flag value from argv.
 * Supports `--flag value` format.
 */
function getFlag(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return undefined;
  return argv[idx + 1];
}

/**
 * Parse CLI flags into ScaffoldOptions.
 *
 * @param argv - The argument vector (typically process.argv.slice(2))
 * @returns Parsed ScaffoldOptions, or null if required flags are missing
 */
export function parseFlags(argv: string[]): ScaffoldOptions | null {
  // Name can be a positional arg (first non-flag arg) or --name flag
  const nameFlag = getFlag(argv, "--name");
  const positionalName = argv.find((arg) => !arg.startsWith("-"));
  const name = nameFlag ?? positionalName;

  if (!name) {
    console.error("Error: Plugin name is required. Provide it as a positional argument or with --name.");
    return null;
  }

  if (!KEBAB_CASE_RE.test(name)) {
    console.error(`Error: Plugin name "${name}" must be kebab-case (e.g., "my-guard").`);
    return null;
  }

  // Type is required
  const typeFlag = getFlag(argv, "--type");
  if (!typeFlag) {
    console.error("Error: --type flag is required (guard, detection, ui, intel, compliance, full).");
    return null;
  }

  if (!PLUGIN_TYPES.includes(typeFlag as PluginType)) {
    console.error(`Error: Invalid plugin type "${typeFlag}". Must be one of: ${PLUGIN_TYPES.join(", ")}`);
    return null;
  }

  const pluginType = typeFlag as PluginType;

  // Contributions (optional -- defaults to type defaults)
  const contributionsFlag = getFlag(argv, "--contributions");
  let contributions: ContributionPoint[];
  if (contributionsFlag) {
    const parts = contributionsFlag.split(",").map((s) => s.trim());
    const invalid = parts.filter((p) => !CONTRIBUTION_POINTS.includes(p as ContributionPoint));
    if (invalid.length > 0) {
      console.error(`Error: Invalid contribution points: ${invalid.join(", ")}`);
      return null;
    }
    contributions = parts as ContributionPoint[];
  } else {
    contributions = PLUGIN_TYPE_DEFAULTS[pluginType];
  }

  // Publisher (optional, defaults to "my-org")
  const publisher = getFlag(argv, "--publisher") ?? "my-org";

  // Package manager (optional, defaults to "npm")
  const pmFlag = getFlag(argv, "--pm") ?? "npm";
  if (!["npm", "bun", "pnpm"].includes(pmFlag)) {
    console.error(`Error: Invalid package manager "${pmFlag}". Must be one of: npm, bun, pnpm`);
    return null;
  }

  const displayName = toDisplayName(name);
  const outputDir = path.resolve(process.cwd(), name);

  return {
    name,
    displayName,
    publisher,
    type: pluginType,
    contributions,
    packageManager: pmFlag as "npm" | "bun" | "pnpm",
    outputDir,
  };
}
