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

  // ---- Community plugin loading ----

  describe("community plugin loading", () => {
    // Test 10: loadPlugin() for trust="internal" calls resolveModule (existing path)
    it("loadPlugin() for manifest with trust='internal' calls resolveModule", async () => {
      const manifest = createTestManifest({
        id: "internal-plugin",
        trust: "internal",
        activationEvents: ["onStartup"],
        main: "./index.ts",
      });
      registry.register(manifest);

      const resolveModule = vi.fn(async () => createMockModule());
      loader = new PluginLoader({
        registry,
        resolveModule,
      });

      await loader.loadPlugin("internal-plugin");

      expect(resolveModule).toHaveBeenCalledOnce();
    });

    // Test 11: loadPlugin() for trust="community" does NOT call resolveModule
    it("loadPlugin() for manifest with trust='community' does NOT call resolveModule", async () => {
      const manifest = createTestManifest({
        id: "community-noresolve",
        trust: "community",
        activationEvents: ["onStartup"],
        main: "./index.ts",
      });
      registry.register(manifest);

      const resolveModule = vi.fn(async () => createMockModule());
      loader = new PluginLoader({
        registry,
        resolveModule,
        trustOptions: { allowUnsigned: true },
      });

      await loader.loadPlugin("community-noresolve");

      expect(resolveModule).not.toHaveBeenCalled();
    });

    // Test 12: loadPlugin() for trust="community" creates a PluginBridgeHost
    it("loadPlugin() for manifest with trust='community' creates a PluginBridgeHost", async () => {
      const manifest = createTestManifest({
        id: "community-bridge",
        trust: "community",
        activationEvents: ["onStartup"],
        main: "./index.ts",
      });
      registry.register(manifest);

      const iframeContainer = document.createElement("div");
      document.body.appendChild(iframeContainer);

      loader = new PluginLoader({
        registry,
        trustOptions: { allowUnsigned: true },
        iframeContainer,
      });

      await loader.loadPlugin("community-bridge");

      // An iframe should exist in the container
      const iframe = iframeContainer.querySelector("iframe");
      expect(iframe).toBeTruthy();

      // Clean up
      await loader.deactivatePlugin("community-bridge");
      iframeContainer.remove();
    });

    // Test 13: loadPlugin() for trust="community" sets up a message event listener
    it("loadPlugin() for manifest with trust='community' sets up a message event listener on the host window", async () => {
      const manifest = createTestManifest({
        id: "community-listener",
        trust: "community",
        activationEvents: ["onStartup"],
        main: "./index.ts",
      });
      registry.register(manifest);

      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const iframeContainer = document.createElement("div");
      document.body.appendChild(iframeContainer);

      loader = new PluginLoader({
        registry,
        trustOptions: { allowUnsigned: true },
        iframeContainer,
      });

      await loader.loadPlugin("community-listener");

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );

      // Clean up
      addEventListenerSpy.mockRestore();
      await loader.deactivatePlugin("community-listener");
      iframeContainer.remove();
    });

    // Test 14: loadPlugin() for trust="community" reaches "activated" state
    it("loadPlugin() for manifest with trust='community' reaches 'activated' state in the registry", async () => {
      const manifest = createTestManifest({
        id: "community-activated",
        trust: "community",
        activationEvents: ["onStartup"],
        main: "./index.ts",
      });
      registry.register(manifest);

      const iframeContainer = document.createElement("div");
      document.body.appendChild(iframeContainer);

      loader = new PluginLoader({
        registry,
        trustOptions: { allowUnsigned: true },
        iframeContainer,
      });

      await loader.loadPlugin("community-activated");

      expect(registry.get("community-activated")!.state).toBe("activated");

      // Clean up
      await loader.deactivatePlugin("community-activated");
      iframeContainer.remove();
    });

    // Test 15: deactivatePlugin() for a community plugin calls host.destroy() and removes listener
    it("deactivatePlugin() for a community plugin removes the message listener", async () => {
      const manifest = createTestManifest({
        id: "community-deactivate",
        trust: "community",
        activationEvents: ["onStartup"],
        main: "./index.ts",
      });
      registry.register(manifest);

      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const iframeContainer = document.createElement("div");
      document.body.appendChild(iframeContainer);

      loader = new PluginLoader({
        registry,
        trustOptions: { allowUnsigned: true },
        iframeContainer,
      });

      await loader.loadPlugin("community-deactivate");

      await loader.deactivatePlugin("community-deactivate");

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );

      // Clean up
      removeEventListenerSpy.mockRestore();
      iframeContainer.remove();
    });

    // Test 16: deactivatePlugin() for a community plugin sets state to "deactivated"
    it("deactivatePlugin() for a community plugin sets state to 'deactivated' in the registry", async () => {
      const manifest = createTestManifest({
        id: "community-deactivate-state",
        trust: "community",
        activationEvents: ["onStartup"],
        main: "./index.ts",
      });
      registry.register(manifest);

      const iframeContainer = document.createElement("div");
      document.body.appendChild(iframeContainer);

      loader = new PluginLoader({
        registry,
        trustOptions: { allowUnsigned: true },
        iframeContainer,
      });

      await loader.loadPlugin("community-deactivate-state");
      expect(registry.get("community-deactivate-state")!.state).toBe("activated");

      await loader.deactivatePlugin("community-deactivate-state");
      expect(registry.get("community-deactivate-state")!.state).toBe("deactivated");

      // Clean up
      iframeContainer.remove();
    });

    // Test 17: loadPlugin() for trust="community" with no main field still works
    it("loadPlugin() for manifest with trust='community' and no main field uses contributions directly", async () => {
      const manifest = createTestManifest({
        id: "community-no-main",
        trust: "community",
        activationEvents: ["onStartup"],
        contributions: {
          commands: [{ id: "community-no-main:test", title: "Test Command" }],
        },
      });
      // Remove main field
      delete (manifest as Partial<PluginManifest> & { main?: string }).main;
      registry.register(manifest);

      const iframeContainer = document.createElement("div");
      document.body.appendChild(iframeContainer);

      loader = new PluginLoader({
        registry,
        trustOptions: { allowUnsigned: true },
        iframeContainer,
      });

      await loader.loadPlugin("community-no-main");

      expect(registry.get("community-no-main")!.state).toBe("activated");

      // Clean up
      await loader.deactivatePlugin("community-no-main");
      iframeContainer.remove();
    });

    // Test 18: Existing internal plugin tests continue to pass (verified by the tests above)
    it("internal plugin loading path is unchanged after adding community fork", async () => {
      const manifest = createGuardPluginManifest("internal-unchanged");
      registry.register(manifest);

      const mockModule = createMockModule();
      loader = new PluginLoader({
        registry,
        resolveModule: async () => mockModule,
      });

      registeredGuardIds.push("internal-unchanged-guard");
      await loader.loadPlugin("internal-unchanged");

      expect(registry.get("internal-unchanged")!.state).toBe("activated");
      expect(mockModule.activate).toHaveBeenCalledOnce();
      expect(getGuardMeta("internal-unchanged-guard")).toBeDefined();
    });
  });
});
