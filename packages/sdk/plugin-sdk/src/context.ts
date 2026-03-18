/**
 * Plugin Context
 *
 * Defines the PluginContext interface and its namespaced API surfaces.
 * The PluginContext is provided to a plugin's activate() function by the
 * workbench PluginLoader at activation time. The SDK only defines the shape --
 * the workbench creates concrete implementations.
 */

import type {
  Disposable,
  CommandContribution,
  GuardContribution,
  FileTypeContribution,
  StatusBarItemContribution,
  ActivityBarItemContribution,
} from "./types";

// ---- Namespaced API Interfaces ----

/**
 * API for registering commands in the command palette.
 */
export interface CommandsApi {
  /** Register a command with a handler. Returns a disposable to unregister. */
  register(command: CommandContribution, handler: () => void): Disposable;
}

/**
 * API for registering custom guards in the guard pipeline.
 */
export interface GuardsApi {
  /** Register a guard contribution. Returns a disposable to unregister. */
  register(guard: GuardContribution): Disposable;
}

/**
 * API for registering custom file types for detection engineering.
 */
export interface FileTypesApi {
  /** Register a file type contribution. Returns a disposable to unregister. */
  register(fileType: FileTypeContribution): Disposable;
}

/**
 * API for registering status bar items.
 */
export interface StatusBarApi {
  /** Register a status bar item. Returns a disposable to unregister. */
  register(item: StatusBarItemContribution): Disposable;
}

/**
 * API for registering activity bar (left sidebar) items.
 */
export interface SidebarApi {
  /** Register an activity bar item. Returns a disposable to unregister. */
  register(item: ActivityBarItemContribution): Disposable;
}

/**
 * API for plugin-scoped key-value storage.
 */
export interface StorageApi {
  /** Retrieve a value by key. Returns undefined if not set. */
  get(key: string): unknown;
  /** Set a value by key. */
  set(key: string, value: unknown): void;
}

// ---- PluginContext ----

/**
 * The context object provided to a plugin's activate() function.
 * Provides namespaced API access to workbench registries and services.
 *
 * The workbench PluginLoader creates concrete implementations of each
 * API surface and injects them here. The SDK only defines the interface shape.
 */
export interface PluginContext {
  /** The ID of the plugin being activated. */
  pluginId: string;
  /** Subscriptions array -- push disposables here for automatic cleanup on deactivate. */
  subscriptions: Disposable[];
  /** Command palette registration API. */
  commands: CommandsApi;
  /** Guard pipeline registration API. */
  guards: GuardsApi;
  /** File type registration API. */
  fileTypes: FileTypesApi;
  /** Status bar registration API. */
  statusBar: StatusBarApi;
  /** Activity bar (left sidebar) registration API. */
  sidebar: SidebarApi;
  /** Plugin-scoped key-value storage API. */
  storage: StorageApi;
}
