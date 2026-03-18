/**
 * Plugin Loader
 *
 * Core runtime that loads registered plugins, routes their contributions
 * to Phase 1 registries (guard, file type, status bar), handles activation
 * events for lazy loading, and integrates trust verification as a
 * pre-activation gate.
 *
 * The loader bridges "plugin is registered" to "plugin's guards/commands/UI
 * are active in the workbench."
 *
 * Error isolation: Promise.allSettled ensures one failing plugin does not
 * block others from activating.
 *
 * Dependency injection: The `resolveModule` option allows tests to provide
 * mock plugin modules without dynamic import().
 */

import type {
  PluginManifest,
  GuardContribution,
  FileTypeContribution,
  StatusBarItemContribution,
} from "./types";
import { PluginRegistry, pluginRegistry } from "./plugin-registry";
import { verifyPluginTrust } from "./plugin-trust";
import type { TrustVerificationOptions } from "./plugin-trust";
import {
  shouldActivateOnStartup,
  matchActivationEvent,
} from "./activation-events";
import { registerGuard } from "../workbench/guard-registry";
import { registerFileType } from "../workbench/file-type-registry";
import { statusBarRegistry } from "../workbench/status-bar-registry";

// ---- Types ----

/** A dispose function that cleans up a resource. */
export type Disposable = () => void;

/**
 * The contract a plugin module must satisfy.
 * activate() is called during loading; deactivate() is called during unloading.
 */
export interface PluginModule {
  activate(context: PluginActivationContext): Disposable[] | void;
  deactivate?(): void;
}

/**
 * Context provided to a plugin's activate() function.
 */
export interface PluginActivationContext {
  /** The ID of the plugin being activated. */
  pluginId: string;
  /** Subscriptions array -- push disposables here for automatic cleanup. */
  subscriptions: Disposable[];
}

/**
 * A function that resolves a plugin manifest to its module.
 * Default implementation uses dynamic import(manifest.main).
 */
export type ModuleResolver = (manifest: PluginManifest) => Promise<PluginModule>;

/**
 * Options for constructing a PluginLoader.
 */
export interface PluginLoaderOptions {
  /** Plugin registry instance (defaults to singleton). */
  registry?: PluginRegistry;
  /** Module resolver function (defaults to dynamic import). */
  resolveModule?: ModuleResolver;
  /** Trust verification options (publisherKey, allowUnsigned). */
  trustOptions?: TrustVerificationOptions;
}

// ---- Internal state for a loaded plugin ----

interface LoadedPlugin {
  disposables: Disposable[];
  module: PluginModule;
}

// ---- PluginLoader ----

/**
 * The PluginLoader is the core runtime for loading plugins.
 *
 * It reads registered plugins from the PluginRegistry, resolves their
 * modules, routes contributions to Phase 1 registries, and manages
 * the activation lifecycle.
 */
export class PluginLoader {
  private registry: PluginRegistry;
  private resolveModule: ModuleResolver;
  private trustOptions: TrustVerificationOptions;

  /** Plugins that have been loaded and activated. */
  private loadedPlugins = new Map<string, LoadedPlugin>();

  /** Plugins waiting for an activation event before loading. */
  private pendingActivation = new Map<string, PluginManifest>();

  constructor(options?: PluginLoaderOptions) {
    this.registry = options?.registry ?? pluginRegistry;
    this.resolveModule =
      options?.resolveModule ??
      (async (m: PluginManifest) => {
        if (!m.main) {
          throw new Error(`Plugin "${m.id}" has no main entry point`);
        }
        return import(/* @vite-ignore */ m.main) as Promise<PluginModule>;
      });
    this.trustOptions = options?.trustOptions ?? {};
  }

  // ---- Public API ----

  /**
   * Load all registered plugins.
   *
   * Plugins with "onStartup" or "*" activation events are loaded immediately
   * via Promise.allSettled (error isolation). Plugins with other activation
   * events are deferred to pendingActivation.
   */
  async loadAll(): Promise<void> {
    const allPlugins = this.registry
      .getAll()
      .filter((p) => p.state === "installed");

    const startupPlugins: PluginManifest[] = [];
    const deferredPlugins: PluginManifest[] = [];

    for (const plugin of allPlugins) {
      const events = plugin.manifest.activationEvents ?? [];
      if (shouldActivateOnStartup(events)) {
        startupPlugins.push(plugin.manifest);
      } else {
        deferredPlugins.push(plugin.manifest);
      }
    }

    // Store deferred plugins for later activation
    for (const manifest of deferredPlugins) {
      this.pendingActivation.set(manifest.id, manifest);
    }

    // Load startup plugins with error isolation
    if (startupPlugins.length > 0) {
      await Promise.allSettled(
        startupPlugins.map((m) => this.loadPlugin(m.id)),
      );
    }
  }

  /**
   * Load a single plugin by ID.
   *
   * 1. Trust gate: verify plugin signature
   * 2. Set state to "activating"
   * 3. Resolve module
   * 4. Route contributions to registries
   * 5. Call module.activate()
   * 6. Set state to "activated"
   *
   * On any error: set state to "error", clean up partial contributions.
   */
  async loadPlugin(pluginId: string): Promise<void> {
    const registered = this.registry.get(pluginId);
    if (!registered) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    const manifest = registered.manifest;
    const disposables: Disposable[] = [];

    try {
      // 1. Trust gate
      const trustResult = await verifyPluginTrust(
        manifest,
        this.trustOptions,
      );
      if (!trustResult.trusted) {
        this.registry.setState(
          pluginId,
          "error",
          `Trust verification failed: ${trustResult.reason}`,
        );
        return;
      }

      // 2. Set state to "activating"
      this.registry.setState(pluginId, "activating");

      // 3. Resolve module
      const pluginModule = await this.resolveModule(manifest);

      // 4. Route contributions BEFORE calling activate()
      if (manifest.contributions) {
        this.routeContributions(manifest, disposables);
      }

      // 5. Create activation context and call activate()
      const context: PluginActivationContext = {
        pluginId,
        subscriptions: [],
      };

      const activateResult = pluginModule.activate(context);

      // Collect disposables from activate() return and context.subscriptions
      if (Array.isArray(activateResult)) {
        disposables.push(...activateResult);
      }
      disposables.push(...context.subscriptions);

      // 6. Store loaded plugin and set state to "activated"
      this.loadedPlugins.set(pluginId, {
        disposables,
        module: pluginModule,
      });

      this.registry.setState(pluginId, "activated");
    } catch (err) {
      // Clean up any already-registered contributions
      for (const dispose of disposables) {
        try {
          dispose();
        } catch {
          // Best-effort cleanup
        }
      }

      const message =
        err instanceof Error ? err.message : String(err);
      this.registry.setState(pluginId, "error", message);
    }
  }

  /**
   * Trigger an activation event.
   *
   * Checks all pending plugins and activates any whose declared activation
   * events match the fired event. Uses Promise.allSettled for isolation.
   */
  async triggerActivationEvent(event: string): Promise<void> {
    const toActivate: string[] = [];

    for (const [id, manifest] of this.pendingActivation) {
      const events = manifest.activationEvents ?? [];
      if (matchActivationEvent(events, event)) {
        toActivate.push(id);
      }
    }

    // Remove from pending before loading (avoid double-activation)
    for (const id of toActivate) {
      this.pendingActivation.delete(id);
    }

    if (toActivate.length > 0) {
      await Promise.allSettled(
        toActivate.map((id) => this.loadPlugin(id)),
      );
    }
  }

  /**
   * Deactivate a loaded plugin.
   *
   * Calls module.deactivate() if defined, then disposes all contribution
   * registrations and subscriptions. Sets state to "deactivated".
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const loaded = this.loadedPlugins.get(pluginId);
    if (!loaded) {
      return;
    }

    // Call module's deactivate() if it exists
    if (loaded.module.deactivate) {
      loaded.module.deactivate();
    }

    // Dispose all registrations (unregisters contributions)
    for (const dispose of loaded.disposables) {
      try {
        dispose();
      } catch {
        // Best-effort cleanup
      }
    }

    // Remove from loaded plugins
    this.loadedPlugins.delete(pluginId);

    // Update registry state
    this.registry.setState(pluginId, "deactivated");
  }

  // ---- Private helpers ----

  /**
   * Route a plugin's contributions to the appropriate Phase 1 registries.
   * Stores dispose functions in the provided array for cleanup.
   */
  private routeContributions(
    manifest: PluginManifest,
    disposables: Disposable[],
  ): void {
    const contributions = manifest.contributions;
    if (!contributions) return;

    // Route guard contributions
    if (contributions.guards) {
      for (const guard of contributions.guards) {
        const dispose = this.routeGuardContribution(guard);
        disposables.push(dispose);
      }
    }

    // Route file type contributions
    if (contributions.fileTypes) {
      for (const fileType of contributions.fileTypes) {
        const dispose = this.routeFileTypeContribution(fileType);
        disposables.push(dispose);
      }
    }

    // Route status bar item contributions
    if (contributions.statusBarItems) {
      for (const item of contributions.statusBarItems) {
        const dispose = this.routeStatusBarItemContribution(item);
        disposables.push(dispose);
      }
    }
  }

  /**
   * Route a guard contribution to the guard registry.
   */
  private routeGuardContribution(guard: GuardContribution): Disposable {
    return registerGuard({
      id: guard.id,
      name: guard.name,
      technicalName: guard.technicalName,
      description: guard.description,
      category: guard.category,
      defaultVerdict: guard.defaultVerdict,
      icon: guard.icon,
      configFields: guard.configFields,
    });
  }

  /**
   * Route a file type contribution to the file type registry.
   */
  private routeFileTypeContribution(
    fileType: FileTypeContribution,
  ): Disposable {
    return registerFileType({
      id: fileType.id,
      label: fileType.label,
      shortLabel: fileType.shortLabel,
      extensions: fileType.extensions,
      iconColor: fileType.iconColor,
      defaultContent: fileType.defaultContent,
      testable: fileType.testable,
      convertibleTo: [],
    });
  }

  /**
   * Route a status bar item contribution to the status bar registry.
   * Note: StatusBarItemContribution has an entrypoint field for dynamic
   * module loading, but the render function is resolved at activation time.
   * For now, we register a placeholder that can be updated later.
   */
  private routeStatusBarItemContribution(
    item: StatusBarItemContribution,
  ): Disposable {
    return statusBarRegistry.register({
      id: item.id,
      side: item.side,
      priority: item.priority,
      render: () => null,
    });
  }
}

// ---- Singleton ----

/** Singleton PluginLoader instance for the workbench. */
export const pluginLoader = new PluginLoader();
