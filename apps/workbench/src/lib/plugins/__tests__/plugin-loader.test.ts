/**
 * PluginLoader Tests
 *
 * Tests for the PluginLoader: contribution routing to Phase 1 registries,
 * error isolation via Promise.allSettled, activation events for lazy loading,
 * trust verification gating, and clean deactivation with dispose.
 *
 * Uses dependency injection via `resolveModule` to avoid dynamic import() in tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PluginRegistry } from "../plugin-registry";
import { createTestManifest } from "../manifest-validation";
import { getGuardMeta, unregisterGuard } from "../../workbench/guard-registry";
import type { PluginManifest, GuardContribution } from "../types";
import { PluginLoader } from "../plugin-loader";
import type { PluginModule, PluginActivationContext } from "../plugin-loader";

// ---- Test fixtures ----

const TEST_GUARD: GuardContribution = {
  id: "test-plugin-guard",
  name: "Test Plugin Guard",
  technicalName: "TestPluginGuard",
  description: "A guard contributed by a test plugin",
  category: "custom",
  defaultVerdict: "deny",
  icon: "IconShield",
  configFields: [],
};

function createGuardPluginManifest(
  id = "guard-plugin",
  overrides?: Partial<PluginManifest>,
): PluginManifest {
  return createTestManifest({
    id,
    trust: "internal",
    activationEvents: ["onStartup"],
    main: "./index.ts",
    contributions: {
      guards: [{ ...TEST_GUARD, id: `${id}-guard` }],
    },
    ...overrides,
  });
}

function createCommandPluginManifest(
  id = "cmd-plugin",
  overrides?: Partial<PluginManifest>,
): PluginManifest {
  return createTestManifest({
    id,
    trust: "internal",
    activationEvents: ["onStartup"],
    main: "./index.ts",
    contributions: {
      commands: [{ id: `${id}:run`, title: "Run Test Command" }],
    },
    ...overrides,
  });
}

function createMockModule(overrides?: Partial<PluginModule>): PluginModule {
  return {
    activate: vi.fn(() => []),
    deactivate: vi.fn(),
    ...overrides,
  };
}

// ---- Test suite ----

describe("PluginLoader", () => {
  let registry: PluginRegistry;
  let loader: PluginLoader;

  // Track guard IDs registered during tests for cleanup
  const registeredGuardIds: string[] = [];

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  afterEach(() => {
    // Clean up any guards registered during tests
    for (const id of registeredGuardIds) {
      unregisterGuard(id);
    }
    registeredGuardIds.length = 0;
  });

  // Test 1: loadPlugin() with guard contribution routes to guard registry
  it("loadPlugin() with a guard contribution calls registerGuard() and the guard is findable via getGuardMeta()", async () => {
    const manifest = createGuardPluginManifest("guard-test");
    registry.register(manifest);

    const mockModule = createMockModule();
    loader = new PluginLoader({
      registry,
      resolveModule: async () => mockModule,
    });

    registeredGuardIds.push("guard-test-guard");
    await loader.loadPlugin("guard-test");

    const guardMeta = getGuardMeta("guard-test-guard");
    expect(guardMeta).toBeDefined();
    expect(guardMeta!.name).toBe("Test Plugin Guard");
    expect(guardMeta!.category).toBe("custom");
  });

  // Test 2: loadPlugin() with a command contribution stores the command handler via activate()
  it("loadPlugin() with a command contribution calls activate() which receives the activation context", async () => {
    const manifest = createCommandPluginManifest("cmd-test");
    registry.register(manifest);

    const activateFn = vi.fn((_ctx: PluginActivationContext) => []);
    const mockModule = createMockModule({ activate: activateFn });

    loader = new PluginLoader({
      registry,
      resolveModule: async () => mockModule,
    });

    await loader.loadPlugin("cmd-test");

    expect(activateFn).toHaveBeenCalledOnce();
    const ctx = activateFn.mock.calls[0][0];
    expect(ctx.pluginId).toBe("cmd-test");
    expect(ctx.subscriptions).toBeInstanceOf(Array);
  });

  // Test 3: loadPlugin() transitions registry state: installed -> activating -> activated
  it("loadPlugin() transitions state: installed -> activating -> activated", async () => {
    const manifest = createGuardPluginManifest("state-test");
    registry.register(manifest);

    const stateTransitions: string[] = [];
    registry.subscribe("stateChanged", (event) => {
      if (event.newState) stateTransitions.push(event.newState);
    });

    const mockModule = createMockModule();
    loader = new PluginLoader({
      registry,
      resolveModule: async () => mockModule,
    });

    registeredGuardIds.push("state-test-guard");
    await loader.loadPlugin("state-test");

    expect(stateTransitions).toContain("activating");
    expect(stateTransitions).toContain("activated");
    expect(registry.get("state-test")!.state).toBe("activated");
  });

  // Test 4: loadPlugin() with a plugin whose activate() throws transitions to "error"
  it("loadPlugin() with activate() that throws transitions to 'error' state", async () => {
    const manifest = createTestManifest({
      id: "error-plugin",
      trust: "internal",
      activationEvents: ["onStartup"],
      main: "./index.ts",
    });
    registry.register(manifest);

    const mockModule = createMockModule({
      activate: () => {
        throw new Error("Plugin activation failed!");
      },
    });

    loader = new PluginLoader({
      registry,
      resolveModule: async () => mockModule,
    });

    await loader.loadPlugin("error-plugin");

    const plugin = registry.get("error-plugin")!;
    expect(plugin.state).toBe("error");
    expect(plugin.error).toContain("Plugin activation failed!");
  });

  // Test 5: loadAll() with two plugins where one throws -- the other still activates
  it("loadAll() isolates failures: one throwing plugin does not block the other", async () => {
    const successManifest = createTestManifest({
      id: "success-plugin",
      trust: "internal",
      activationEvents: ["onStartup"],
      main: "./index.ts",
    });
    const failManifest = createTestManifest({
      id: "fail-plugin",
      trust: "internal",
      activationEvents: ["onStartup"],
      main: "./index.ts",
    });

    registry.register(successManifest);
    registry.register(failManifest);

    const modules: Record<string, PluginModule> = {
      "success-plugin": createMockModule(),
      "fail-plugin": createMockModule({
        activate: () => {
          throw new Error("I fail on purpose");
        },
      }),
    };

    loader = new PluginLoader({
      registry,
      resolveModule: async (m) => modules[m.id],
    });

    await loader.loadAll();

    expect(registry.get("success-plugin")!.state).toBe("activated");
    expect(registry.get("fail-plugin")!.state).toBe("error");
  });

  // Test 6: loadPlugin() with onFileType activation event does NOT activate immediately
  it("plugin with onFileType activation event does NOT activate on loadAll(); triggerActivationEvent activates it", async () => {
    const manifest = createTestManifest({
      id: "lazy-plugin",
      trust: "internal",
      activationEvents: ["onFileType:sigma_rule"],
      main: "./index.ts",
    });
    registry.register(manifest);

    const mockModule = createMockModule();
    loader = new PluginLoader({
      registry,
      resolveModule: async () => mockModule,
    });

    await loader.loadAll();

    // Should NOT have been activated yet
    expect(registry.get("lazy-plugin")!.state).toBe("installed");

    // Now trigger the activation event
    await loader.triggerActivationEvent("onFileType:sigma_rule");

    expect(registry.get("lazy-plugin")!.state).toBe("activated");
  });

  // Test 7: loadPlugin() with onStartup activates immediately
  it("plugin with onStartup activation event activates immediately on loadAll()", async () => {
    const manifest = createTestManifest({
      id: "startup-plugin",
      trust: "internal",
      activationEvents: ["onStartup"],
      main: "./index.ts",
    });
    registry.register(manifest);

    const mockModule = createMockModule();
    loader = new PluginLoader({
      registry,
      resolveModule: async () => mockModule,
    });

    await loader.loadAll();

    expect(registry.get("startup-plugin")!.state).toBe("activated");
  });

  // Test 8: deactivatePlugin() calls dispose functions and transitions state to "deactivated"
  it("deactivatePlugin() calls dispose functions and transitions to 'deactivated'", async () => {
    const manifest = createGuardPluginManifest("deactivate-test");
    registry.register(manifest);

    const deactivateFn = vi.fn();
    const mockModule = createMockModule({ deactivate: deactivateFn });

    loader = new PluginLoader({
      registry,
      resolveModule: async () => mockModule,
    });

    registeredGuardIds.push("deactivate-test-guard");
    await loader.loadPlugin("deactivate-test");

    expect(registry.get("deactivate-test")!.state).toBe("activated");
    // Guard should be registered
    expect(getGuardMeta("deactivate-test-guard")).toBeDefined();

    await loader.deactivatePlugin("deactivate-test");

    expect(registry.get("deactivate-test")!.state).toBe("deactivated");
    expect(deactivateFn).toHaveBeenCalledOnce();
    // Guard should be unregistered after deactivation
    expect(getGuardMeta("deactivate-test-guard")).toBeUndefined();
    // Remove from cleanup list since it's already unregistered
    const idx = registeredGuardIds.indexOf("deactivate-test-guard");
    if (idx !== -1) registeredGuardIds.splice(idx, 1);
  });

  // Test 9: loadPlugin() rejects unsigned non-internal plugin (trust verification gate)
  it("loadPlugin() rejects unsigned non-internal plugin with trust gate error", async () => {
    const manifest = createTestManifest({
      id: "untrusted-plugin",
      trust: "community",
      activationEvents: ["onStartup"],
      main: "./index.ts",
    });
    registry.register(manifest);

    const mockModule = createMockModule();
    loader = new PluginLoader({
      registry,
      resolveModule: async () => mockModule,
    });

    await loader.loadPlugin("untrusted-plugin");

    const plugin = registry.get("untrusted-plugin")!;
    expect(plugin.state).toBe("error");
    expect(plugin.error).toBeTruthy();
    // The module's activate should NOT have been called
    expect(mockModule.activate).not.toHaveBeenCalled();
  });
});
