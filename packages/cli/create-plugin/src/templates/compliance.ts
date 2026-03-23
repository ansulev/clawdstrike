import type { ScaffoldOptions } from "../types";

export function complianceSourceTemplate(options: ScaffoldOptions): string {
  return `import { createPlugin } from "@clawdstrike/plugin-sdk";
import type {
  PluginContext,
  ComplianceFrameworkContribution,
  CommandContribution,
} from "@clawdstrike/plugin-sdk";

const framework: ComplianceFrameworkContribution = {
  id: "${options.name}-framework",
  name: "${options.displayName}",
  description: "Compliance framework: ${options.displayName}",
  entrypoint: "./framework",
};

const auditCommand: CommandContribution = {
  id: "${options.publisher}.${options.name}.audit",
  title: "Run ${options.displayName} Audit",
};

export default createPlugin({
  manifest: {
    id: "${options.publisher}.${options.name}",
    name: "${options.name}",
    displayName: "${options.displayName}",
    description: "A compliance framework plugin for ClawdStrike",
    version: "0.1.0",
    publisher: "${options.publisher}",
    categories: ["compliance"],
    trust: "community",
    activationEvents: ["onStartup"],
    main: "./dist/index.js",
    contributions: {
      complianceFrameworks: [framework],
      commands: [auditCommand],
    },
  },

  activate(ctx: PluginContext) {
    const cmdDisposable = ctx.commands.register(auditCommand, () => {
      console.log("Run ${options.displayName} Audit");
    });
    ctx.subscriptions.push(cmdDisposable);
  },

  deactivate() {
    // Cleanup handled by subscriptions
  },
});
`;
}
