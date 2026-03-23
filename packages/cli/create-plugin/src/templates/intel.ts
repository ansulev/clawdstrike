/**
 * Threat intel source plugin source template.
 *
 * Generates a src/index.ts that creates a threat intel plugin with:
 * - A ThreatIntelSourceContribution
 * - A lookup command
 * - requiredSecrets for API key
 * - Proper activation with command registration
 */

import type { ScaffoldOptions } from "../types";

/**
 * Generate the source template for an intel-type plugin.
 *
 * @param options - Scaffold options from CLI prompts or flags
 * @returns Complete src/index.ts content for a threat intel plugin
 */
export function intelSourceTemplate(options: ScaffoldOptions): string {
  return `import { createPlugin } from "@clawdstrike/plugin-sdk";
import type {
  PluginContext,
  ThreatIntelSourceContribution,
  CommandContribution,
} from "@clawdstrike/plugin-sdk";

const intelSource: ThreatIntelSourceContribution = {
  id: "${options.name}-intel",
  name: "${options.displayName}",
  description: "Threat intelligence source provided by ${options.displayName}",
  entrypoint: "./source",
};

const lookupCommand: CommandContribution = {
  id: "${options.publisher}.${options.name}.lookup",
  title: "Lookup via ${options.displayName}",
};

export default createPlugin({
  manifest: {
    id: "${options.publisher}.${options.name}",
    name: "${options.name}",
    displayName: "${options.displayName}",
    description: "A threat intel source plugin for ClawdStrike",
    version: "0.1.0",
    publisher: "${options.publisher}",
    categories: ["intel"],
    trust: "community",
    activationEvents: ["onStartup"],
    main: "./dist/index.js",
    contributions: {
      threatIntelSources: [intelSource],
      commands: [lookupCommand],
    },
    requiredSecrets: [
      {
        key: "api_key",
        label: "${options.displayName} API Key",
        description: "API key for ${options.displayName} lookups",
      },
    ],
  },

  activate(ctx: PluginContext) {
    const cmdDisposable = ctx.commands.register(lookupCommand, () => {
      console.log("Lookup via ${options.displayName}");
    });
    ctx.subscriptions.push(cmdDisposable);
  },

  deactivate() {
    // Cleanup handled by subscriptions
  },
});
`;
}
