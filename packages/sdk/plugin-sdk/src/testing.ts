/**
 * Plugin Testing Utilities
 *
 * Provides mock and spy implementations of PluginContext for unit testing
 * plugins in isolation without running the workbench.
 *
 * Usage:
 * ```typescript
 * import { createMockContext, createSpyContext, MockStorageApi } from '@clawdstrike/plugin-sdk/testing';
 *
 * // Simple mock (no-op stubs):
 * const ctx = createMockContext();
 * myPlugin.activate(ctx);
 *
 * // Spy context (tracks registrations):
 * const { ctx, spy } = createSpyContext();
 * myPlugin.activate(ctx);
 * expect(spy.commands.registered).toHaveLength(1);
 * ```
 */

import type {
  Disposable,
  ComponentType,
  PluginContributions,
  CommandContribution,
  GuardContribution,
  FileTypeContribution,
  StatusBarItemContribution,
  ActivityBarItemContribution,
  EditorTabViewContribution,
  BottomPanelTabViewContribution,
  RightSidebarPanelViewContribution,
  StatusBarWidgetViewContribution,
} from "./types";

import type {
  PluginContext,
  StorageApi,
  SecretsApi,
} from "./context";

import type { PluginDefinition } from "./create-plugin";

import {
  validateManifest,
  createTestManifest,
  type ManifestValidationError,
  type ManifestValidationResult,
} from "./manifest-validation";

// ---- Re-exports from manifest-validation ----

export { createTestManifest, type ManifestValidationError, type ManifestValidationResult };

// ---- MockStorageApi ----

/**
 * Map-backed implementation of StorageApi for testing.
 * Provides additional entries() and clear() methods for test assertions.
 */
export class MockStorageApi implements StorageApi {
  private _store = new Map<string, unknown>();

  get(key: string): unknown {
    return this._store.get(key);
  }

  set(key: string, value: unknown): void {
    this._store.set(key, value);
  }

  /** Returns all stored [key, value] pairs as an array. */
  entries(): Array<[string, unknown]> {
    return Array.from(this._store.entries());
  }

  /** Clears all stored values. Useful for resetting state between tests. */
  clear(): void {
    this._store.clear();
  }
}

// ---- MockSecretsApi ----

/**
 * Map-backed implementation of SecretsApi for testing.
 * All methods return Promises to match the async SecretsApi interface.
 */
export class MockSecretsApi implements SecretsApi {
  private _store = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this._store.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this._store.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this._store.delete(key);
    return Promise.resolve();
  }

  has(key: string): Promise<boolean> {
    return Promise.resolve(this._store.has(key));
  }
}

// ---- SpyData ----

/**
 * Spy tracking data exposed by createSpyContext().
 * Each API namespace has a `registered` array that captures what was registered.
 */
export interface SpyData {
  commands: { registered: Array<{ contribution: CommandContribution; handler: () => void }> };
  guards: { registered: GuardContribution[] };
  fileTypes: { registered: FileTypeContribution[] };
  statusBar: { registered: StatusBarItemContribution[] };
  sidebar: { registered: ActivityBarItemContribution[] };
  views: {
    editorTabs: EditorTabViewContribution[];
    bottomPanelTabs: BottomPanelTabViewContribution[];
    rightSidebarPanels: RightSidebarPanelViewContribution[];
    statusBarWidgets: StatusBarWidgetViewContribution[];
  };
  enrichmentRenderers: { registered: Array<{ type: string; component: ComponentType }> };
  storage: MockStorageApi;
  secrets: MockSecretsApi;
  subscriptions: Disposable[];
}

/**
 * A PluginContext augmented with spy tracking.
 */
export interface SpyContext {
  ctx: PluginContext;
  spy: SpyData;
}

// ---- No-op Disposable ----

const noop: Disposable = () => {};

// ---- createMockContext ----

/**
 * Creates a PluginContext with no-op stubs for every API method.
 * Storage uses MockStorageApi; secrets uses MockSecretsApi.
 * Pass partial overrides to selectively replace any API namespace.
 */
export function createMockContext(overrides?: Partial<PluginContext>): PluginContext {
  return {
    pluginId: "test.plugin",
    subscriptions: [],
    commands: {
      register: (_command: CommandContribution, _handler: () => void): Disposable => noop,
    },
    guards: {
      register: (_guard: GuardContribution): Disposable => noop,
    },
    fileTypes: {
      register: (_fileType: FileTypeContribution): Disposable => noop,
    },
    statusBar: {
      register: (_item: StatusBarItemContribution): Disposable => noop,
    },
    sidebar: {
      register: (_item: ActivityBarItemContribution): Disposable => noop,
    },
    storage: new MockStorageApi(),
    views: {
      registerEditorTab: (_contribution: EditorTabViewContribution): Disposable => noop,
      registerBottomPanelTab: (_contribution: BottomPanelTabViewContribution): Disposable => noop,
      registerRightSidebarPanel: (_contribution: RightSidebarPanelViewContribution): Disposable => noop,
      registerStatusBarWidget: (_contribution: StatusBarWidgetViewContribution): Disposable => noop,
    },
    secrets: new MockSecretsApi(),
    enrichmentRenderers: {
      register: (_type: string, _component: ComponentType): Disposable => noop,
    },
    ...overrides,
  };
}

// ---- createSpyContext ----

/**
 * Helper: creates a disposable that removes an item from an array by reference.
 */
function makeRemovingDisposable<T>(arr: T[], item: T): Disposable {
  return () => {
    const idx = arr.indexOf(item);
    if (idx !== -1) {
      arr.splice(idx, 1);
    }
  };
}

/**
 * Creates a PluginContext with spy tracking for all registration APIs.
 * Each register() call pushes to its tracking array and returns a Disposable
 * that splices the item out when called.
 *
 * Returns `{ ctx, spy }` where `ctx` is the PluginContext and `spy` holds
 * all tracking arrays.
 *
 * Overrides merge on top -- overridden APIs will NOT have spy tracking
 * (that's expected, since the caller is providing their own implementation).
 */
export function createSpyContext(overrides?: Partial<PluginContext>): SpyContext {
  const commandsRegistered: Array<{ contribution: CommandContribution; handler: () => void }> = [];
  const guardsRegistered: GuardContribution[] = [];
  const fileTypesRegistered: FileTypeContribution[] = [];
  const statusBarRegistered: StatusBarItemContribution[] = [];
  const sidebarRegistered: ActivityBarItemContribution[] = [];
  const editorTabs: EditorTabViewContribution[] = [];
  const bottomPanelTabs: BottomPanelTabViewContribution[] = [];
  const rightSidebarPanels: RightSidebarPanelViewContribution[] = [];
  const statusBarWidgets: StatusBarWidgetViewContribution[] = [];
  const enrichmentRenderersRegistered: Array<{ type: string; component: ComponentType }> = [];
  const storage = new MockStorageApi();
  const secrets = new MockSecretsApi();
  const subscriptions: Disposable[] = [];

  const ctx: PluginContext = {
    pluginId: "test.plugin",
    subscriptions,
    commands: {
      register: (command: CommandContribution, handler: () => void): Disposable => {
        const entry = { contribution: command, handler };
        commandsRegistered.push(entry);
        return makeRemovingDisposable(commandsRegistered, entry);
      },
    },
    guards: {
      register: (guard: GuardContribution): Disposable => {
        guardsRegistered.push(guard);
        return makeRemovingDisposable(guardsRegistered, guard);
      },
    },
    fileTypes: {
      register: (fileType: FileTypeContribution): Disposable => {
        fileTypesRegistered.push(fileType);
        return makeRemovingDisposable(fileTypesRegistered, fileType);
      },
    },
    statusBar: {
      register: (item: StatusBarItemContribution): Disposable => {
        statusBarRegistered.push(item);
        return makeRemovingDisposable(statusBarRegistered, item);
      },
    },
    sidebar: {
      register: (item: ActivityBarItemContribution): Disposable => {
        sidebarRegistered.push(item);
        return makeRemovingDisposable(sidebarRegistered, item);
      },
    },
    storage,
    views: {
      registerEditorTab: (contribution: EditorTabViewContribution): Disposable => {
        editorTabs.push(contribution);
        return makeRemovingDisposable(editorTabs, contribution);
      },
      registerBottomPanelTab: (contribution: BottomPanelTabViewContribution): Disposable => {
        bottomPanelTabs.push(contribution);
        return makeRemovingDisposable(bottomPanelTabs, contribution);
      },
      registerRightSidebarPanel: (contribution: RightSidebarPanelViewContribution): Disposable => {
        rightSidebarPanels.push(contribution);
        return makeRemovingDisposable(rightSidebarPanels, contribution);
      },
      registerStatusBarWidget: (contribution: StatusBarWidgetViewContribution): Disposable => {
        statusBarWidgets.push(contribution);
        return makeRemovingDisposable(statusBarWidgets, contribution);
      },
    },
    secrets,
    enrichmentRenderers: {
      register: (type: string, component: ComponentType): Disposable => {
        const entry = { type, component };
        enrichmentRenderersRegistered.push(entry);
        return makeRemovingDisposable(enrichmentRenderersRegistered, entry);
      },
    },
    ...overrides,
  };

  const spy: SpyData = {
    commands: { registered: commandsRegistered },
    guards: { registered: guardsRegistered },
    fileTypes: { registered: fileTypesRegistered },
    statusBar: { registered: statusBarRegistered },
    sidebar: { registered: sidebarRegistered },
    views: {
      editorTabs,
      bottomPanelTabs,
      rightSidebarPanels,
      statusBarWidgets,
    },
    enrichmentRenderers: { registered: enrichmentRenderersRegistered },
    storage,
    secrets,
    subscriptions,
  };

  return { ctx, spy };
}

// ---- Assertion Helpers ----

/**
 * Assert that a plugin's manifest declares the expected number of contribution
 * points for each specified key. Checks every key in `expected` and reports
 * all mismatches in a single error.
 *
 * @param plugin - A PluginDefinition (from createPlugin)
 * @param expected - Map of contribution key to expected count
 * @throws Error with "Contribution count mismatch" and per-key details
 *
 * @example
 * ```typescript
 * assertContributions(myPlugin, { guards: 1, commands: 2 });
 * ```
 */
export function assertContributions(
  plugin: PluginDefinition,
  expected: Partial<Record<keyof PluginContributions, number>>,
): void {
  const contributions = plugin.manifest.contributions;
  const mismatches: string[] = [];

  for (const [key, expectedCount] of Object.entries(expected)) {
    const actual = (contributions?.[key as keyof PluginContributions] as unknown[] | undefined) ?? [];
    const actualCount = actual.length;
    if (actualCount !== expectedCount) {
      mismatches.push(`${key}: expected ${expectedCount}, got ${actualCount}`);
    }
  }

  if (mismatches.length > 0) {
    throw new Error("Contribution count mismatch:\n" + mismatches.join("\n"));
  }
}

/**
 * Assert that a manifest passes validation. Wraps `validateManifest()` and
 * throws a detailed assertion error listing all field-level validation errors.
 *
 * @param manifest - The value to validate (any shape)
 * @throws Error with "Invalid manifest (N error(s))" and per-field details
 *
 * @example
 * ```typescript
 * assertManifestValid(createTestManifest({ id: "" })); // throws
 * assertManifestValid(createTestManifest());            // passes
 * ```
 */
export function assertManifestValid(manifest: unknown): void {
  const result = validateManifest(manifest);
  if (!result.valid) {
    throw new Error(
      `Invalid manifest (${result.errors.length} error(s)):\n` +
        result.errors.map((e) => `  - ${e.field}: ${e.message}`).join("\n"),
    );
  }
}
