/**
 * Interactive prompts for the create-plugin CLI.
 *
 * Uses @clack/prompts to collect plugin configuration from the user
 * in an interactive terminal session.
 */

import path from "node:path";
import * as p from "@clack/prompts";
import type { ScaffoldOptions, PluginType, ContributionPoint } from "./types";
import {
  CONTRIBUTION_POINTS,
  CONTRIBUTION_LABELS,
  PLUGIN_TYPE_DEFAULTS,
} from "./types";

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
 * Run interactive prompts to collect scaffold options.
 *
 * @param initialName - Optional pre-filled plugin name (from positional arg)
 * @returns Assembled ScaffoldOptions from user input
 */
export async function runInteractivePrompts(
  initialName?: string,
): Promise<ScaffoldOptions> {
  p.intro("Create ClawdStrike Plugin");

  // 1. Plugin name (kebab-case)
  const name = await p.text({
    message: "Plugin name (kebab-case):",
    initialValue: initialName,
    validate(value) {
      if (!value || value.trim().length === 0) {
        return "Plugin name is required.";
      }
      if (!KEBAB_CASE_RE.test(value)) {
        return 'Must be kebab-case (e.g., "my-guard").';
      }
      return undefined;
    },
  });
  if (p.isCancel(name)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // 2. Display name
  const displayName = await p.text({
    message: "Display name:",
    initialValue: toDisplayName(name),
    validate(value) {
      if (!value || value.trim().length === 0) {
        return "Display name is required.";
      }
      return undefined;
    },
  });
  if (p.isCancel(displayName)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // 3. Publisher
  const publisher = await p.text({
    message: "Publisher:",
    initialValue: "my-org",
    validate(value) {
      if (!value || value.trim().length === 0) {
        return "Publisher is required.";
      }
      return undefined;
    },
  });
  if (p.isCancel(publisher)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // 4. Plugin type
  const pluginType = await p.select<PluginType>({
    message: "Plugin type:",
    options: [
      { value: "guard" as const, label: "Guard - Custom security guard" },
      { value: "detection" as const, label: "Detection - Detection format adapter" },
      { value: "ui" as const, label: "UI - Custom panels and views" },
      { value: "intel" as const, label: "Intel - Threat intelligence source" },
      { value: "compliance" as const, label: "Compliance - Compliance framework" },
      { value: "full" as const, label: "Full - All contribution points" },
    ],
  });
  if (p.isCancel(pluginType)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // 5. Contribution points (multi-select with type defaults pre-selected)
  const contributions = await p.multiselect<ContributionPoint>({
    message: "Contribution points:",
    options: CONTRIBUTION_POINTS.map((cp) => ({
      value: cp,
      label: CONTRIBUTION_LABELS[cp],
    })),
    initialValues: PLUGIN_TYPE_DEFAULTS[pluginType],
    required: true,
  });
  if (p.isCancel(contributions)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // 6. Package manager
  const packageManager = await p.select<"npm" | "bun" | "pnpm">({
    message: "Package manager:",
    options: [
      { value: "npm" as const, label: "npm" },
      { value: "bun" as const, label: "bun" },
      { value: "pnpm" as const, label: "pnpm" },
    ],
  });
  if (p.isCancel(packageManager)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  return {
    name,
    displayName,
    publisher,
    type: pluginType,
    contributions,
    packageManager,
    outputDir: path.resolve(process.cwd(), name),
  };
}
