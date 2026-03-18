import { describe, it, expect } from "vitest";
import {
  validateManifest,
  createTestManifest,
  type ManifestValidationError,
} from "../manifest-validation";
import type { PluginManifest } from "../types";

describe("validateManifest", () => {
  // Test 1: Valid manifest passes
  it("accepts a valid manifest with all required fields", () => {
    const manifest = createTestManifest();
    const result = validateManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // Test 2: Missing id
  it("rejects a manifest missing the id field", () => {
    const manifest = createTestManifest();
    const { id, ...withoutId } = manifest;
    const result = validateManifest(withoutId);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e: ManifestValidationError) => e.field.includes("id"))).toBe(true);
  });

  // Test 3: Missing name
  it("rejects a manifest missing the name field", () => {
    const manifest = createTestManifest();
    const { name, ...withoutName } = manifest;
    const result = validateManifest(withoutName);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e: ManifestValidationError) => e.field.includes("name"))).toBe(true);
  });

  // Test 4: Missing version
  it("rejects a manifest missing the version field", () => {
    const manifest = createTestManifest();
    const { version, ...withoutVersion } = manifest;
    const result = validateManifest(withoutVersion);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e: ManifestValidationError) => e.field.includes("version"))).toBe(true);
  });

  // Test 5: Invalid trust tier
  it("rejects a manifest with an invalid trust tier", () => {
    const manifest = createTestManifest({ trust: "unknown" as PluginManifest["trust"] });
    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e: ManifestValidationError) => e.field.includes("trust"))).toBe(true);
  });

  // Test 6: Invalid semver version
  it("rejects a manifest with an invalid version string", () => {
    const manifest = createTestManifest({ version: "not-semver" });
    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e: ManifestValidationError) => e.field.includes("version"))).toBe(true);
  });

  // Test 7: Guard contribution missing id
  it("rejects a guard contribution missing the id field", () => {
    const manifest = createTestManifest({
      contributions: {
        guards: [
          {
            name: "Test Guard",
            technicalName: "test_guard",
            description: "A test guard",
            category: "content",
            defaultVerdict: "deny",
            icon: "shield",
            configFields: [],
          } as unknown as PluginManifest["contributions"] extends infer C
            ? C extends { guards: (infer G)[] }
              ? G
              : never
            : never,
        ],
      },
    });
    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e: ManifestValidationError) => e.field === "guards[0].id")).toBe(true);
  });

  // Test 8: Guard contribution missing configFields
  it("rejects a guard contribution missing configFields", () => {
    const manifest = createTestManifest({
      contributions: {
        guards: [
          {
            id: "test.guard",
            name: "Test Guard",
            technicalName: "test_guard",
            description: "A test guard",
            category: "content",
            defaultVerdict: "deny",
            icon: "shield",
            // configFields intentionally omitted
          } as unknown as PluginManifest["contributions"] extends infer C
            ? C extends { guards: (infer G)[] }
              ? G
              : never
            : never,
        ],
      },
    });
    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e: ManifestValidationError) => e.field === "guards[0].configFields")).toBe(true);
  });

  // Test 9: Command contribution missing title
  it("rejects a command contribution missing the title field", () => {
    const manifest = createTestManifest({
      contributions: {
        commands: [
          {
            id: "test.command",
            // title intentionally omitted
          } as unknown as PluginManifest["contributions"] extends infer C
            ? C extends { commands: (infer Cmd)[] }
              ? Cmd
              : never
            : never,
        ],
      },
    });
    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e: ManifestValidationError) => e.field === "commands[0].title")).toBe(true);
  });

  // Test 10: Empty contributions object is valid
  it("accepts a manifest with empty contributions object", () => {
    const manifest = createTestManifest({ contributions: {} });
    const result = validateManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // Test 11: Valid installation metadata passes
  it("accepts a manifest with valid installation metadata", () => {
    const manifest = createTestManifest({
      installation: {
        downloadUrl: "https://plugins.clawdstrike.com/test-plugin-1.0.0.tgz",
        size: 102400,
        checksum: "a".repeat(64),
        signature: "base64signaturestring",
      },
    });
    const result = validateManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // Test 12: Installation metadata missing checksum
  it("rejects installation metadata with missing checksum", () => {
    const manifest = createTestManifest({
      installation: {
        downloadUrl: "https://plugins.clawdstrike.com/test-plugin-1.0.0.tgz",
        size: 102400,
        signature: "base64signaturestring",
        // checksum intentionally omitted
      } as unknown as PluginManifest["installation"],
    });
    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e: ManifestValidationError) => e.field === "installation.checksum"),
    ).toBe(true);
  });

  // Test 13: Multiple errors are accumulated
  it("accumulates multiple errors without short-circuiting", () => {
    const { id, name, ...withoutIdAndName } = createTestManifest();
    const result = validateManifest(withoutIdAndName);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);

    const fields = result.errors.map((e: ManifestValidationError) => e.field);
    expect(fields).toContain("id");
    expect(fields).toContain("name");
  });
});
