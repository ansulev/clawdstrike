/**
 * CLI entry point for @clawdstrike/create-plugin.
 *
 * Routes to interactive prompts or non-interactive flag parsing
 * based on the --non-interactive flag.
 */

import { parseFlags } from "./flags";
import { runInteractivePrompts } from "./prompts";
import { scaffoldProject } from "./engine";
import type { ScaffoldOptions } from "./types";

/**
 * Main CLI function.
 *
 * - If --non-interactive is present, parses flags and scaffolds immediately.
 * - Otherwise, runs interactive @clack/prompts and then scaffolds.
 */
export async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const nonInteractive = argv.includes("--non-interactive");

  let options: ScaffoldOptions;

  if (nonInteractive) {
    const parsed = parseFlags(argv);
    if (!parsed) {
      console.error(
        "\nUsage: create-plugin <name> --type <type> --non-interactive [--contributions <list>] [--publisher <name>] [--pm <npm|bun|pnpm>]",
      );
      process.exit(1);
    }
    options = parsed;
  } else {
    // Extract positional name arg (first non-flag argument)
    const positionalName = argv.find((arg) => !arg.startsWith("-"));
    options = await runInteractivePrompts(positionalName);
  }

  await scaffoldProject(options);

  const pm = options.packageManager;
  const installCmd = pm === "npm" ? "npm install" : pm === "bun" ? "bun install" : "pnpm install";
  const buildCmd = pm === "npm" ? "npm run build" : pm === "bun" ? "bun run build" : "pnpm build";
  const testCmd = pm === "npm" ? "npm test" : pm === "bun" ? "bun test" : "pnpm test";

  console.log(`
Plugin "${options.displayName}" created at ${options.outputDir}

Next steps:
  cd ${options.name}
  ${installCmd}
  ${buildCmd}
  ${testCmd}
`);
}
