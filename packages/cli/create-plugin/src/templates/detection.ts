/**
 * Detection adapter plugin source template.
 *
 * Generates a src/index.ts that creates a detection plugin with:
 * - A FileTypeContribution for a custom detection format
 * - A DetectionAdapterContribution linking to the file type
 * - A validate command
 * - Proper activation with ctx.fileTypes.register()
 */

import type { ScaffoldOptions } from "../types";

/**
 * Generate the source template for a detection-type plugin.
 *
 * @param options - Scaffold options from CLI prompts or flags
 * @returns Complete src/index.ts content for a detection plugin
 */
export function detectionSourceTemplate(options: ScaffoldOptions): string {
  const shortLabel = options.name.slice(0, 3).toUpperCase();

  return `import { createPlugin } from "@clawdstrike/plugin-sdk";
import type {
  PluginContext,
  FileTypeContribution,
  DetectionAdapterContribution,
  CommandContribution,
} from "@clawdstrike/plugin-sdk";

const fileTypeDef: FileTypeContribution = {
  id: "${options.name}",
  label: "${options.displayName}",
  shortLabel: "${shortLabel}",
  extensions: [".${options.name}"],
  iconColor: "#4FC3F7",
  defaultContent: "// ${options.displayName} detection rule\\n",
  testable: true,
};

const adapterDef: DetectionAdapterContribution = {
  fileType: "${options.name}",
  entrypoint: "./adapter",
};

const validateCommand: CommandContribution = {
  id: "${options.publisher}.${options.name}.validate",
  title: "Validate ${options.displayName}",
};

export default createPlugin({
  manifest: {
    id: "${options.publisher}.${options.name}",
    name: "${options.name}",
    displayName: "${options.displayName}",
    description: "A detection adapter plugin for ClawdStrike",
    version: "0.1.0",
    publisher: "${options.publisher}",
    categories: ["detection"],
    trust: "community",
    activationEvents: ["onStartup"],
    main: "./dist/index.js",
    contributions: {
      fileTypes: [fileTypeDef],
      detectionAdapters: [adapterDef],
      commands: [validateCommand],
    },
  },

  activate(ctx: PluginContext) {
    const ftDisposable = ctx.fileTypes.register(fileTypeDef);
    ctx.subscriptions.push(ftDisposable);

    const cmdDisposable = ctx.commands.register(validateCommand, () => {
      console.log("Validate ${options.displayName}");
    });
    ctx.subscriptions.push(cmdDisposable);
  },

  deactivate() {
    // Cleanup handled by subscriptions
  },
});
`;
}
