/**
 * Plugin Loader
 *
 * Core runtime that loads registered plugins, routes their contributions
 * to Phase 1 registries (guard, file type, status bar), handles activation
 * events for lazy loading, and integrates trust verification as a
 * pre-activation gate.
 *
 * Trust-tier fork: Internal plugins load in-process via dynamic import,
 * while community plugins are isolated in sandboxed iframes with a
 * postMessage bridge for API access. This ensures community plugins
 * cannot access the host DOM, Tauri IPC, or any browser APIs beyond
 * what the bridge explicitly exposes.
 *
 * Error isolation: Promise.allSettled ensures one failing plugin does not
 * block others from activating.
 *
 * Dependency injection: The `resolveModule` option allows tests to provide
 * mock plugin modules without dynamic import().
 */

import { lazy, createElement } from "react";
import type { ComponentType } from "react";
import type {
  PluginManifest,
  GuardContribution,
  FileTypeContribution,
  StatusBarItemContribution,
  NetworkPermission,
  PluginPermission,
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
import { registerThreatIntelSource } from "../workbench/threat-intel-registry";
import { registerView } from "./view-registry";
import { registerGutterExtension } from "./gutter-extension-registry";
import { registerContextMenuItem } from "./context-menu-registry";
import { registerEnrichmentRenderer } from "./enrichment-type-registry";
import { createSecretsApi } from "./secrets-api";
import type { SecretsApi } from "./secrets-api";
import type { GutterConfig } from "./types";
import { PluginBridgeHost } from "./bridge";
import { buildPluginSrcdoc } from "./sandbox";
import {
  PluginRevocationStore,
  getPluginRevocationStore,
} from "./revocation-store";

// ---- Constants ----

/** Time in ms to wait for in-flight bridge calls to complete before removing iframe. */
const REVOKE_DRAIN_TIMEOUT_MS = 5000;

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
  /** Plugin-scoped secrets API for credential storage (keys auto-prefixed with plugin ID). */
  secrets: SecretsApi;
  /** Views API for registering plugin-contributed views in workbench UI slots. */
  views: {
    registerEditorTab(contribution: {
      id: string;
      label: string;
      icon?: string;
      component: ComponentType<any> | (() => Promise<{ default: ComponentType<any> }>);
    }): Disposable;
    registerBottomPanelTab(contribution: {
      id: string;
      label: string;
      icon?: string;
      component: ComponentType<any> | (() => Promise<{ default: ComponentType<any> }>);
    }): Disposable;
    registerRightSidebarPanel(contribution: {
      id: string;
      label: string;
      icon?: string;
      component: ComponentType<any> | (() => Promise<{ default: ComponentType<any> }>);
    }): Disposable;
    registerStatusBarWidget(contribution: {
      id: string;
      side: "left" | "right";
      priority: number;
      component: ComponentType<any> | (() => Promise<{ default: ComponentType<any> }>);
    }): Disposable;
  };
}

/**
 * A function that resolves a plugin manifest to its module.
 * Default implementation uses dynamic import(manifest.main).
 */
export type ModuleResolver = (manifest: PluginManifest) => Promise<PluginModule>;

/**
 * A function that resolves a plugin manifest to its bundled JavaScript source.
 * Used for community plugins loaded into sandboxed iframes.
 */
export type PluginCodeResolver = (manifest: PluginManifest) => Promise<string>;

/**
 * A function that resolves a contribution entrypoint path to its module.
 * Used for threat intel sources, gutter extensions, and other async entrypoints.
 * Default implementation uses dynamic import().
 */
export type EntrypointResolver = (entrypoint: string) => Promise<Record<string, unknown>>;

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
  /** Container element for community plugin iframes. Defaults to document.body. */
  iframeContainer?: HTMLElement;
  /** Function to resolve plugin code for community plugins. Returns the bundled JS string. */
  resolvePluginCode?: PluginCodeResolver;
  /** Revocation store for checking/storing revocations. Defaults to singleton. */
  revocationStore?: PluginRevocationStore;
  /** Entrypoint resolver for contribution modules (defaults to dynamic import). */
  resolveEntrypoint?: EntrypointResolver;
}

// ---- Internal state for a loaded plugin ----

interface LoadedPlugin {
  disposables: Disposable[];
  module: PluginModule | null; // null for community plugins (code runs in iframe)
  bridgeHost?: PluginBridgeHost; // only for community plugins
  messageHandler?: (event: MessageEvent) => void; // for cleanup
  iframe?: HTMLIFrameElement; // for cleanup
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
  private resolveEntrypoint: EntrypointResolver;
  private trustOptions: TrustVerificationOptions;
  private iframeContainer?: HTMLElement;
  private resolvePluginCode?: PluginCodeResolver;
  private revocationStore: PluginRevocationStore;

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
    this.resolveEntrypoint =
      options?.resolveEntrypoint ??
      (async (entrypoint: string) =>
        import(/* @vite-ignore */ entrypoint) as Promise<Record<string, unknown>>);
    this.trustOptions = options?.trustOptions ?? {};
    this.iframeContainer = options?.iframeContainer;
    this.resolvePluginCode = options?.resolvePluginCode;
    this.revocationStore =
      options?.revocationStore ?? getPluginRevocationStore();
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
    // Revocation gate: block loading if the plugin is currently revoked
    if (this.revocationStore.isRevoked(pluginId)) {
      this.registry.setState(pluginId, "revoked");
      return;
    }

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

      // 2. Trust-tier fork: community plugins load via iframe sandbox
      if (manifest.trust === "community") {
        await this.loadCommunityPlugin(pluginId, manifest, disposables);
        return;
      }

      // ---- Internal plugin path (in-process) ----

      // 3. Set state to "activating"
      this.registry.setState(pluginId, "activating");

      // 4. Resolve module
      const pluginModule = await this.resolveModule(manifest);

      // 5. Route contributions BEFORE calling activate()
      if (manifest.contributions) {
        this.routeContributions(manifest, disposables);
      }

      // 6. Create activation context and call activate()
      const context: PluginActivationContext = {
        pluginId,
        subscriptions: [],
        secrets: createSecretsApi(pluginId),
        views: this.buildViewsApi(pluginId, disposables),
      };

      const activateResult = pluginModule.activate(context);

      // Collect disposables from activate() return and context.subscriptions
      if (Array.isArray(activateResult)) {
        disposables.push(...activateResult);
      }
      disposables.push(...context.subscriptions);

      // 7. Store loaded plugin and set state to "activated"
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
   * registrations and subscriptions. Sets state to "deactivated" unless
   * `preserveState` is true (used by revokePlugin to keep "revoked" state).
   */
  async deactivatePlugin(
    pluginId: string,
    options?: { preserveState?: boolean },
  ): Promise<void> {
    const loaded = this.loadedPlugins.get(pluginId);
    if (!loaded) {
      return;
    }

    // Call module's deactivate() if it exists (internal plugins only)
    if (loaded.module?.deactivate) {
      loaded.module.deactivate();
    }

    // Clean up community plugin resources
    if (loaded.bridgeHost) {
      loaded.bridgeHost.destroy();
    }
    if (loaded.messageHandler) {
      window.removeEventListener("message", loaded.messageHandler);
    }
    if (loaded.iframe) {
      loaded.iframe.remove();
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

    // Update registry state (skip if caller wants to preserve current state,
    // e.g., revokePlugin needs to keep "revoked" rather than overwriting
    // with "deactivated")
    if (!options?.preserveState) {
      this.registry.setState(pluginId, "deactivated");
    }
  }

  /**
   * Revoke a plugin: store revocation, set state to "revoked", wait for
   * in-flight calls to drain (5 seconds), then deactivate the plugin.
   *
   * The drain timeout (REVOKE_DRAIN_TIMEOUT_MS) gives in-flight bridge
   * calls time to complete before the iframe is removed. During the drain
   * period, new bridge calls are rejected with PLUGIN_REVOKED by the
   * bridge host's revocation guard.
   */
  async revokePlugin(
    pluginId: string,
    options?: { reason?: string; until?: number | null },
  ): Promise<void> {
    // 1. Store the revocation (this immediately causes bridge host to reject new calls)
    this.revocationStore.revoke(pluginId, options);

    // 2. Set lifecycle state to "revoked"
    this.registry.setState(pluginId, "revoked", options?.reason);

    // 3. Wait for in-flight calls to drain
    await new Promise<void>((resolve) =>
      setTimeout(resolve, REVOKE_DRAIN_TIMEOUT_MS),
    );

    // 4. Deactivate: dispose contributions, remove iframe, destroy bridge.
    //    Preserve the "revoked" state -- don't let deactivatePlugin overwrite it.
    await this.deactivatePlugin(pluginId, { preserveState: true });
  }

  // ---- Private helpers ----

  /**
   * Load a community plugin into a sandboxed iframe with bridge wiring.
   *
   * Creates an invisible iframe with sandbox="allow-scripts" (NO allow-same-origin),
   * injects the plugin code via srcdoc, wires up a PluginBridgeHost for postMessage
   * RPC, and routes manifest contributions to host registries.
   *
   * The iframe is invisible by default -- community plugins contribute UI through
   * bridge-registered contribution points, not direct DOM access.
   */
  private async loadCommunityPlugin(
    pluginId: string,
    manifest: PluginManifest,
    disposables: Disposable[],
  ): Promise<void> {
    // Set state to "activating"
    this.registry.setState(pluginId, "activating");

    let iframe: HTMLIFrameElement | undefined;

    try {
      // Resolve plugin code (if resolver provided, otherwise empty string)
      const pluginCode = this.resolvePluginCode
        ? await this.resolvePluginCode(manifest)
        : "";

      // Create and configure the iframe
      iframe = document.createElement("iframe");
      // Use setAttribute for sandbox -- the DOMTokenList API is not available in all environments
      // Explicitly set ONLY "allow-scripts" -- do NOT add allow-same-origin (null-origin isolation)
      iframe.setAttribute("sandbox", "allow-scripts");
      iframe.srcdoc = buildPluginSrcdoc({ pluginCode, pluginId });
      iframe.style.cssText =
        "width: 0; height: 0; border: none; position: absolute; visibility: hidden";

      // Append to container (defaults to document.body)
      const container = this.iframeContainer ?? document.body;
      container.appendChild(iframe);

      // Get the iframe's contentWindow for bridge communication.
      // contentWindow is available immediately after appendChild -- no need
      // to wait for onload since we only need the postMessage channel, not
      // the iframe's internal DOM readiness.
      const targetWindow = iframe.contentWindow;
      if (!targetWindow) {
        throw new Error(
          `Plugin "${pluginId}" iframe contentWindow is null`,
        );
      }

      // Build permissions for the bridge host
      const perms = manifest.permissions;
      let bridgePermissions: string[] | undefined;
      let bridgeNetworkPermissions: NetworkPermission[] | undefined;

      if (perms !== undefined) {
        // Manifest declares permissions (possibly empty) -- enforce
        bridgePermissions = perms.filter(
          (p): p is PluginPermission => typeof p === "string",
        );
        const netPerms = perms.filter(
          (p): p is NetworkPermission =>
            typeof p === "object" && p !== null && p.type === "network:fetch",
        );
        // Include network:fetch in simple permissions if any NetworkPermission objects exist
        if (netPerms.length > 0 && !bridgePermissions.includes("network:fetch")) {
          bridgePermissions.push("network:fetch");
        }
        bridgeNetworkPermissions =
          netPerms.length > 0 ? netPerms : undefined;
      }
      // If perms is undefined, both stay undefined => no enforcement (backward compat)

      // Create the bridge host
      const host = new PluginBridgeHost({
        pluginId,
        targetWindow,
        permissions: bridgePermissions,
        networkPermissions: bridgeNetworkPermissions,
        revocationStore: this.revocationStore,
      });

      // Create and attach message handler
      const messageHandler = (e: MessageEvent): void => {
        host.handleMessage(e);
      };
      window.addEventListener("message", messageHandler);

      // Route manifest contributions (static declarations go through host registries)
      if (manifest.contributions) {
        this.routeContributions(manifest, disposables);
      }

      // Store community plugin state
      this.loadedPlugins.set(pluginId, {
        disposables,
        module: null,
        bridgeHost: host,
        messageHandler,
        iframe,
      });

      // Set state to "activated"
      this.registry.setState(pluginId, "activated");
    } catch (err) {
      // Clean up iframe on error
      if (iframe?.parentNode) {
        iframe.remove();
      }

      // Clean up any already-registered contributions
      for (const dispose of disposables) {
        try {
          dispose();
        } catch {
          // Best-effort cleanup
        }
      }

      const message = err instanceof Error ? err.message : String(err);
      this.registry.setState(pluginId, "error", message);
    }
  }

  /**
   * Build a concrete ViewsApi for a plugin's activation context.
   *
   * Each method namespaces the view ID as "{pluginId}.{viewId}", calls
   * registerView (or statusBarRegistry.register), and pushes the dispose
   * function to the disposables array for automatic cleanup.
   */
  private buildViewsApi(
    pluginId: string,
    disposables: Disposable[],
  ): PluginActivationContext["views"] {
    const resolveComponent = (
      comp: ComponentType<any> | (() => Promise<{ default: ComponentType<any> }>),
    ): ComponentType<any> => {
      if (typeof comp !== "function") {
        return comp as ComponentType<any>;
      }

      // Explicit sentinel: functions marked with __lazy are lazy factories.
      if ("__lazy" in comp && (comp as any).__lazy === true) {
        return lazy(comp as () => Promise<{ default: ComponentType<any> }>);
      }

      // Probe heuristic: call the function and check if it returns a Promise.
      // This distinguishes lazy import factories (return Promise) from React
      // components that ignore props (return JSX/null). We avoid wrapping
      // React components in React.lazy which would crash.
      if (comp.length === 0) {
        try {
          const result = (comp as Function)();
          if (result && typeof result === "object" && typeof result.then === "function") {
            // It returned a Promise -- it's a lazy factory. Use React.lazy
            // with a new wrapper that returns the already-initiated promise.
            return lazy(() => result as Promise<{ default: ComponentType<any> }>);
          }
        } catch {
          // If calling it threw, it's likely a React component that
          // needs a render context. Fall through and use it directly.
        }
      }

      return comp as ComponentType<any>;
    };

    return {
      registerEditorTab(contribution) {
        const viewId = `${pluginId}.${contribution.id}`;
        const dispose = registerView({
          id: viewId,
          slot: "editorTab",
          label: contribution.label,
          icon: contribution.icon,
          component: resolveComponent(contribution.component),
        });
        disposables.push(dispose);
        return dispose;
      },
      registerBottomPanelTab(contribution) {
        const viewId = `${pluginId}.${contribution.id}`;
        const dispose = registerView({
          id: viewId,
          slot: "bottomPanelTab",
          label: contribution.label,
          icon: contribution.icon,
          component: resolveComponent(contribution.component),
        });
        disposables.push(dispose);
        return dispose;
      },
      registerRightSidebarPanel(contribution) {
        const viewId = `${pluginId}.${contribution.id}`;
        const dispose = registerView({
          id: viewId,
          slot: "rightSidebarPanel",
          label: contribution.label,
          icon: contribution.icon,
          component: resolveComponent(contribution.component),
        });
        disposables.push(dispose);
        return dispose;
      },
      registerStatusBarWidget(contribution) {
        const viewId = `${pluginId}.${contribution.id}`;
        const dispose = statusBarRegistry.register({
          id: viewId,
          side: contribution.side,
          priority: contribution.priority,
          render: () => {
            const Comp = resolveComponent(contribution.component);
            return createElement(Comp, { viewId });
          },
        });
        disposables.push(dispose);
        return dispose;
      },
    };
  }

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
        const dispose = this.routeStatusBarItemContribution(item, manifest);
        disposables.push(dispose);
      }
    }

    // Route editor tab contributions to ViewRegistry
    if (contributions.editorTabs) {
      for (const tab of contributions.editorTabs) {
        const viewId = `${manifest.id}.${tab.id}`;
        const dispose = registerView({
          id: viewId,
          slot: "editorTab",
          label: tab.label,
          icon: tab.icon,
          component: lazy(() => this.resolveViewEntrypoint(tab.entrypoint, manifest)),
        });
        disposables.push(dispose);
      }
    }

    // Route bottom panel tab contributions to ViewRegistry
    if (contributions.bottomPanelTabs) {
      for (const tab of contributions.bottomPanelTabs) {
        const viewId = `${manifest.id}.${tab.id}`;
        const dispose = registerView({
          id: viewId,
          slot: "bottomPanelTab",
          label: tab.label,
          icon: tab.icon,
          component: lazy(() => this.resolveViewEntrypoint(tab.entrypoint, manifest)),
        });
        disposables.push(dispose);
      }
    }

    // Route right sidebar panel contributions to ViewRegistry
    if (contributions.rightSidebarPanels) {
      for (const panel of contributions.rightSidebarPanels) {
        const viewId = `${manifest.id}.${panel.id}`;
        const dispose = registerView({
          id: viewId,
          slot: "rightSidebarPanel",
          label: panel.label,
          icon: panel.icon,
          component: lazy(() => this.resolveViewEntrypoint(panel.entrypoint, manifest)),
        });
        disposables.push(dispose);
      }
    }

    // Route activity bar item contributions to ViewRegistry
    if (contributions.activityBarItems) {
      for (const item of contributions.activityBarItems) {
        const viewId = `${manifest.id}.${item.id}`;
        const dispose = registerView({
          id: viewId,
          slot: "activityBarPanel",
          label: item.label,
          icon: item.icon,
          component: item.entrypoint
            ? lazy(() => this.resolveViewEntrypoint(item.entrypoint!, manifest))
            : (() => null) as ComponentType<any>,
          priority: item.order,
          meta: { section: item.section, href: item.href, entrypoint: item.entrypoint },
        });
        disposables.push(dispose);
      }
    }

    // Route gutter decoration contributions to GutterExtensionRegistry
    if (contributions.gutterDecorations) {
      for (const deco of contributions.gutterDecorations) {
        const decoId = `${manifest.id}.${deco.id}`;
        const resolvedDecoEntrypoint = this.resolveEntrypointUrl(deco.entrypoint, manifest);
        void (async () => {
          try {
            const mod = await import(/* @vite-ignore */ resolvedDecoEntrypoint);
            const factory = mod.createGutterExtension ?? mod.default;
            if (typeof factory === "function") {
              const config: GutterConfig = { pluginId: manifest.id, decorationId: decoId };
              const extension = factory(config);
              const dispose = registerGutterExtension({ id: decoId, extension });
              disposables.push(dispose);
            }
          } catch (err) {
            console.warn(`[PluginLoader] Failed to load gutter extension "${decoId}":`, err);
          }
        })();
      }
    }

    // Route detection adapter contributions
    // The actual registerAdapter() call happens when the plugin's activate()
    // function runs through the SDK bridge. The manifest contribution here is
    // declarative -- it tells the system which file types the plugin handles.
    if (contributions.detectionAdapters) {
      for (const adapter of contributions.detectionAdapters) {
        console.debug(
          `[PluginLoader] Detection adapter declared for "${(adapter as { fileType: string }).fileType}" by plugin "${manifest.id}"`,
        );
      }
    }

    // Route threat intel source contributions to ThreatIntelSourceRegistry
    if (contributions.threatIntelSources) {
      for (const source of contributions.threatIntelSources) {
        const sourceId = `${manifest.id}.${source.id}`;
        void (async () => {
          try {
            const mod = await this.resolveEntrypoint(source.entrypoint);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sourceImpl = (mod.default ?? mod) as Record<string, any>;
            if (sourceImpl && typeof sourceImpl.enrich === "function") {
              // Ensure the source ID is namespaced to the plugin
              const registeredSource = { ...sourceImpl, id: sourceId };
              const dispose = registerThreatIntelSource(registeredSource as any);
              disposables.push(dispose);
            } else {
              console.warn(
                `[PluginLoader] Threat intel source "${sourceId}" entrypoint does not export a valid ThreatIntelSource (missing enrich method)`,
              );
            }
          } catch (err) {
            console.warn(`[PluginLoader] Failed to load threat intel source "${sourceId}":`, err);
          }
        })();
      }
    }

    // Route context menu item contributions to ContextMenuRegistry
    if (contributions.contextMenuItems) {
      for (const item of contributions.contextMenuItems) {
        const itemId = `${manifest.id}.${item.id}`;
        const dispose = registerContextMenuItem({
          id: itemId,
          label: item.label,
          command: item.command,
          icon: item.icon,
          when: item.when,
          menu: item.menu,
        });
        disposables.push(dispose);
      }
    }

    // Route enrichment renderer contributions to EnrichmentTypeRegistry
    if (contributions.enrichmentRenderers) {
      for (const renderer of contributions.enrichmentRenderers) {
        const LazyComponent = lazy(() => this.resolveViewEntrypoint(renderer.entrypoint, manifest));
        const dispose = registerEnrichmentRenderer(renderer.type, LazyComponent);
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
   * Resolves the entrypoint module asynchronously and uses the exported
   * component as the render function. Falls back to null if resolution fails.
   *
   * After the async import resolves, the item is re-registered to notify
   * the status bar that new content is available.
   */
  private routeStatusBarItemContribution(
    item: StatusBarItemContribution,
    manifest?: PluginManifest,
  ): Disposable {
    let resolvedComponent: ComponentType<unknown> | null = null;

    // Resolve entrypoint relative to the plugin's root, not plugin-loader.ts
    const resolvedEntrypoint = this.resolveEntrypointUrl(item.entrypoint, manifest);

    // Kick off async resolution -- update the render once resolved and
    // re-register the item so the status bar is notified of the change.
    void (async () => {
      try {
        const mod = await import(/* @vite-ignore */ resolvedEntrypoint);
        resolvedComponent = mod.default ?? mod;
        // Re-register the item to trigger a status bar notification.
        // unregister is a no-op if not found, register will rebuild snapshots
        // and notify useSyncExternalStore subscribers.
        statusBarRegistry.unregister(item.id);
        statusBarRegistry.register({
          id: item.id,
          side: item.side,
          priority: item.priority,
          render: () => createElement(resolvedComponent!, { viewId: item.id }),
        });
      } catch {
        // Entrypoint resolution failed -- render stays null gracefully
      }
    })();

    return statusBarRegistry.register({
      id: item.id,
      side: item.side,
      priority: item.priority,
      render: () => {
        if (resolvedComponent) {
          return createElement(resolvedComponent, { viewId: item.id });
        }
        return null;
      },
    });
  }

  /**
   * Resolve a contribution entrypoint path relative to the plugin's root.
   *
   * Bare paths from a plugin manifest are relative to the plugin's
   * installation directory, not to plugin-loader.ts. In the browser,
   * we resolve them by constructing a full URL using the plugin's main
   * entry as the base. Falls back to using the entrypoint as-is if no
   * manifest context is available (e.g., built-in plugins).
   */
  private resolveEntrypointUrl(entrypoint: string, manifest?: PluginManifest): string {
    // Already an absolute URL -- use as-is
    if (entrypoint.startsWith("http://") || entrypoint.startsWith("https://") || entrypoint.startsWith("/")) {
      return entrypoint;
    }

    // If the plugin has a main entry, resolve relative to its directory
    if (manifest?.main) {
      try {
        const baseUrl = new URL(manifest.main, window.location.href);
        return new URL(entrypoint, baseUrl).href;
      } catch {
        // URL construction failed -- fall through to raw entrypoint
      }
    }

    return entrypoint;
  }

  /**
   * Resolve a view entrypoint to a module with a default export.
   * Used by React.lazy() for deferred component loading.
   */
  private async resolveViewEntrypoint(
    entrypoint: string,
    manifest?: PluginManifest,
  ): Promise<{ default: ComponentType<unknown> }> {
    const resolved = this.resolveEntrypointUrl(entrypoint, manifest);
    const mod = await import(/* @vite-ignore */ resolved);
    return { default: mod.default ?? mod };
  }
}

// ---- Singleton ----

/** Singleton PluginLoader instance for the workbench. */
export const pluginLoader = new PluginLoader();
