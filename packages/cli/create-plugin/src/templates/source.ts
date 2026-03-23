/**
 * Source and test template generators for scaffolded plugin projects.
 *
 * These are placeholders -- Plan 02-02 replaces them with type-specific
 * templates for each of the 6 plugin types.
 */

import type { ScaffoldOptions } from "../types";

/**
 * Get the source template (src/index.ts) for the given plugin type.
 *
 * @param options - Scaffold options including plugin type and contributions
 * @returns TypeScript source code for the plugin entry point
 */
export function getSourceTemplate(options: ScaffoldOptions): string {
  const contributionsObj = options.contributions
    .map((cp) => {
      switch (cp) {
        case "guards":
          return `      guards: [{
        id: "${options.name}.example-guard",
        name: "Example Guard",
        technicalName: "example_guard",
        description: "An example guard from ${options.displayName}",
        category: "custom",
        defaultVerdict: "deny" as const,
        icon: "shield",
        configFields: [],
      }]`;
        case "commands":
          return `      commands: [{
        id: "${options.name}.hello",
        title: "Hello from ${options.displayName}",
        category: "${options.displayName}",
      }]`;
        default:
          return `      // TODO: Add ${cp} contributions`;
      }
    })
    .join(",\n");

  return `import { createPlugin } from "@clawdstrike/plugin-sdk";
import type { PluginDefinition } from "@clawdstrike/plugin-sdk";

/**
 * ${options.displayName} plugin.
 *
 * Type: ${options.type}
 * TODO: Replace this stub with real implementation (see Plan 02-02).
 */
const plugin: PluginDefinition = createPlugin({
  manifest: {
    id: "${options.publisher}.${options.name}",
    name: "${options.name}",
    displayName: "${options.displayName}",
    description: "A ${options.type} plugin for ClawdStrike",
    version: "0.1.0",
    publisher: "${options.publisher}",
    categories: ["${options.type}"],
    trust: "community",
    activationEvents: ["onStartup"],
    main: "./dist/index.js",
    contributions: {
${contributionsObj}
    },
  },

  activate(context) {
    // TODO: Implement activation logic
    console.log("${options.displayName} activated");

    return [
      // Return disposables for cleanup
    ];
  },

  deactivate() {
    console.log("${options.displayName} deactivated");
  },
});

export default plugin;
`;
}

/**
 * Get the test template (tests/plugin.test.ts) for the given plugin type.
 *
 * @param options - Scaffold options including plugin type and contributions
 * @returns TypeScript test source code
 */
export function getTestTemplate(options: ScaffoldOptions): string {
  const hasGuards = options.contributions.includes("guards");
  const hasCommands = options.contributions.includes("commands");

  const assertions: string[] = [];
  if (hasGuards) {
    assertions.push(`
    // Check that guards were registered
    expect(spy.guards.registered.length).toBeGreaterThan(0);`);
  }
  if (hasCommands) {
    assertions.push(`
    // Check that commands were registered
    expect(spy.commands.registered.length).toBeGreaterThan(0);`);
  }

  return `import { describe, it, expect } from "vitest";
import { createSpyContext } from "@clawdstrike/plugin-sdk/testing";
import plugin from "../src/index";

describe("${options.displayName}", () => {
  it("should have a valid manifest", () => {
    expect(plugin.manifest.id).toBe("${options.publisher}.${options.name}");
    expect(plugin.manifest.name).toBe("${options.name}");
    expect(plugin.manifest.version).toBe("0.1.0");
  });

  it("should activate without errors", () => {
    const { ctx, spy } = createSpyContext();
    expect(() => plugin.activate(ctx)).not.toThrow();${assertions.join("")}
  });

  it("should deactivate without errors", () => {
    if (plugin.deactivate) {
      expect(() => plugin.deactivate!()).not.toThrow();
    }
  });
});
`;
}
