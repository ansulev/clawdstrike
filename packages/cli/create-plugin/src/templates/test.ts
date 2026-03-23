/**
 * Test file template generator.
 *
 * Generates a tests/plugin.test.ts that:
 * - Imports describe/it/expect from vitest
 * - Imports createSpyContext and assertContributions from @clawdstrike/plugin-sdk/testing
 * - Tests activation, contribution registration, and manifest fields
 * - Adapts assertions based on plugin type
 */

import type { ScaffoldOptions } from "../types";

/**
 * Generate the test template for any plugin type.
 *
 * @param options - Scaffold options including plugin type
 * @returns Complete tests/plugin.test.ts content
 */
export function getTestTemplate(options: ScaffoldOptions): string {
  const typeAssertions = getTypeSpecificAssertions(options);

  return `import { describe, it, expect } from "vitest";
import { createSpyContext, assertContributions } from "@clawdstrike/plugin-sdk/testing";
import plugin from "../src/index";

describe("${options.displayName} plugin", () => {
  it("activates without errors", () => {
    const { ctx } = createSpyContext();
    expect(() => plugin.activate(ctx)).not.toThrow();
  });

  it("registers expected contributions", () => {
    const { ctx, spy } = createSpyContext();
    plugin.activate(ctx);
${typeAssertions}
  });

  it("manifest has required fields", () => {
    expect(plugin.manifest.id).toBeDefined();
    expect(plugin.manifest.name).toBeDefined();
    expect(plugin.manifest.version).toBeDefined();
    expect(plugin.manifest.publisher).toBeDefined();
  });
});
`;
}

/**
 * Generate type-specific assertion lines for the test template.
 */
function getTypeSpecificAssertions(options: ScaffoldOptions): string {
  switch (options.type) {
    case "guard":
      return `    expect(spy.guards.registered.length).toBeGreaterThanOrEqual(1);
    expect(spy.commands.registered.length).toBeGreaterThanOrEqual(1);`;

    case "detection":
      return `    expect(spy.fileTypes.registered.length).toBeGreaterThanOrEqual(1);
    expect(spy.commands.registered.length).toBeGreaterThanOrEqual(1);`;

    case "ui":
      return `    expect(spy.commands.registered.length).toBeGreaterThanOrEqual(1);`;

    case "intel":
      return `    expect(spy.commands.registered.length).toBeGreaterThanOrEqual(1);
    expect(plugin.manifest.requiredSecrets?.length).toBeGreaterThanOrEqual(1);`;

    case "compliance":
      return `    expect(spy.commands.registered.length).toBeGreaterThanOrEqual(1);`;

    case "full":
      return `    expect(spy.guards.registered.length).toBeGreaterThanOrEqual(1);
    expect(spy.commands.registered.length).toBeGreaterThanOrEqual(1);`;

    default:
      return `    // Add type-specific assertions`;
  }
}
