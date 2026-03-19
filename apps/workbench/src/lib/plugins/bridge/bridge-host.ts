/**
 * Plugin Bridge Host
 *
 * The workbench-side receiver for the postMessage bridge. Listens for
 * BridgeRequest messages from plugin iframes, validates origin, dispatches
 * to the appropriate workbench registry, and sends BridgeResponse or
 * BridgeErrorResponse back to the iframe.
 *
 * Security: Only messages with event.origin === allowedOrigin are processed.
 * For srcdoc iframes (the sandboxing model), the origin is the literal string
 * "null". All other origins are silently dropped.
 *
 * Extensibility: External code can register additional handlers via
 * registerHandler() for bridge methods beyond the built-in PluginContext API.
 */

import type {
  BridgeResponse,
  BridgeErrorResponse,
  BridgeEvent,
  BridgeErrorCode,
} from "./types";
import { isBridgeMessage } from "./types";
import {
  checkPermission,
  METHOD_TO_PERMISSION,
  checkNetworkPermission,
} from "./permissions";
import type { NetworkPermission } from "../types";
import { registerGuard } from "../../workbench/guard-registry";
import { registerFileType } from "../../workbench/file-type-registry";
import { statusBarRegistry } from "../../workbench/status-bar-registry";

// ---- Types ----

/**
 * A handler function that processes bridge method params and returns a result.
 * May be synchronous or async.
 */
export type BridgeHandler = (params: unknown) => unknown | Promise<unknown>;

/**
 * Options for constructing a PluginBridgeHost.
 */
export interface BridgeHostOptions {
  /** The ID of the plugin this host manages. */
  pluginId: string;
  /** The iframe's contentWindow for sending responses back. */
  targetWindow: Window;
  /** Expected origin for incoming messages. Defaults to "null" (srcdoc iframe). */
  allowedOrigin?: string;
  /**
   * Declared permissions for the plugin. When provided, only bridge methods
   * whose required permission is in this list will be allowed. When omitted,
   * all calls are allowed (backward compat for internal plugins).
   */
  permissions?: string[];
  /**
   * Network permissions with domain allowlists. Used by the network.fetch
   * handler to enforce domain-scoped access control.
   */
  networkPermissions?: NetworkPermission[];
}

/**
 * Error thrown by bridge handlers to indicate a permission denial at the
 * domain/scope level (e.g., network fetch to an unapproved domain).
 * The dispatch loop catches this and returns PERMISSION_DENIED instead
 * of INTERNAL_ERROR.
 */
class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

// ---- PluginBridgeHost ----

/**
 * The host half of the postMessage bridge, running in the main workbench
 * window. Receives requests from a plugin iframe, dispatches them to
 * workbench registries, and sends results back.
 *
 * Usage:
 * ```ts
 * const host = new PluginBridgeHost({
 *   pluginId: "my-plugin",
 *   targetWindow: iframe.contentWindow!,
 * });
 * window.addEventListener("message", (e) => host.handleMessage(e));
 * ```
 */
export class PluginBridgeHost {
  /** Maps method names to handler functions. */
  private handlers = new Map<string, BridgeHandler>();

  /** Tracked disposables for cleanup on destroy. */
  private disposables: (() => void)[] = [];

  /** Plugin-scoped key/value storage. */
  private storage = new Map<string, unknown>();

  /** Registered command metadata (command handler stays in iframe). */
  private commands = new Map<string, unknown>();

  /** Sidebar contribution data. */
  private sidebarContributions: unknown[] = [];

  private pluginId: string;
  private targetWindow: Window;
  private allowedOrigin: string;

  /**
   * Permission enforcement set. When non-null, only bridge methods whose
   * required permission is in this set are allowed. When null (no permissions
   * declared), all calls pass through (backward compat for internal plugins).
   */
  private permissionSet: Set<string> | null;

  /** Network permissions with domain allowlists for fetch proxying. */
  private networkPermissions: NetworkPermission[];

  constructor(options: BridgeHostOptions) {
    this.pluginId = options.pluginId;
    this.targetWindow = options.targetWindow;
    this.allowedOrigin = options.allowedOrigin ?? "null";
    this.permissionSet = options.permissions
      ? new Set(options.permissions)
      : null;
    this.networkPermissions = options.networkPermissions ?? [];

    this.registerDefaultHandlers();
  }

  // ---- Public API ----

  /**
   * Handle an incoming message event from the iframe.
   *
   * Validates origin, checks that the data is a BridgeRequest, dispatches
   * to the registered handler, and sends the response or error back.
   */
  handleMessage(event: MessageEvent): void {
    // Origin validation -- silently drop mismatches
    if (event.origin !== this.allowedOrigin) {
      return;
    }

    const data = event.data;

    // Only process valid bridge request messages
    if (!isBridgeMessage(data) || data.type !== "request") {
      return;
    }

    const { id, method, params } = data;

    // Permission enforcement -- check BEFORE handler dispatch
    if (this.permissionSet !== null) {
      if (!checkPermission(this.permissionSet, method)) {
        const requiredPerm = METHOD_TO_PERMISSION[method] ?? method;
        this.sendError(
          id,
          "PERMISSION_DENIED",
          `Plugin "${this.pluginId}" requires "${requiredPerm}" permission for "${method}"`,
        );
        return;
      }
    }

    const handler = this.handlers.get(method);
    if (!handler) {
      this.sendError(id, "METHOD_NOT_FOUND", `No handler for "${method}"`);
      return;
    }

    try {
      const result = handler(params);

      // Handle async handlers
      if (result instanceof Promise) {
        result
          .then((resolved) => this.sendResponse(id, resolved))
          .catch((err: unknown) => {
            const code: BridgeErrorCode =
              err instanceof PermissionDeniedError
                ? "PERMISSION_DENIED"
                : "INTERNAL_ERROR";
            const message =
              err instanceof Error ? err.message : String(err);
            this.sendError(id, code, message);
          });
      } else {
        this.sendResponse(id, result);
      }
    } catch (err: unknown) {
      const code: BridgeErrorCode =
        err instanceof PermissionDeniedError
          ? "PERMISSION_DENIED"
          : "INTERNAL_ERROR";
      const message = err instanceof Error ? err.message : String(err);
      this.sendError(id, code, message);
    }
  }

  /**
   * Push an event from the host to the plugin iframe.
   * Events are fire-and-forget (no correlation ID).
   */
  pushEvent(method: string, params?: unknown): void {
    const event: BridgeEvent = { type: "event", method, params };
    this.targetWindow.postMessage(event, "*");
  }

  /**
   * Register an additional bridge handler for extensibility.
   * External code can add bridge methods beyond the built-in PluginContext API.
   */
  registerHandler(method: string, handler: BridgeHandler): void {
    this.handlers.set(method, handler);
  }

  /**
   * Tear down the host: dispose all tracked contributions and clear state.
   */
  destroy(): void {
    for (const dispose of this.disposables) {
      try {
        dispose();
      } catch {
        // Best-effort cleanup
      }
    }
    this.disposables = [];
    this.handlers.clear();
    this.storage.clear();
    this.commands.clear();
    this.sidebarContributions = [];
  }

  // ---- Private ----

  /**
   * Register the default bridge handlers for all 7 PluginContext API methods.
   */
  private registerDefaultHandlers(): void {
    // commands.register -- store command metadata; handler stays in iframe
    this.handlers.set("commands.register", (params: unknown) => {
      const commandData = params as { id: string; [key: string]: unknown };
      this.commands.set(commandData.id, commandData);
      return { registered: true };
    });

    // guards.register -- delegate to the workbench guard registry
    this.handlers.set("guards.register", (params: unknown) => {
      const dispose = registerGuard(
        params as Parameters<typeof registerGuard>[0],
      );
      this.disposables.push(dispose);
      return { registered: true };
    });

    // fileTypes.register -- delegate to the workbench file type registry
    this.handlers.set("fileTypes.register", (params: unknown) => {
      const dispose = registerFileType(
        params as Parameters<typeof registerFileType>[0],
      );
      this.disposables.push(dispose);
      return { registered: true };
    });

    // statusBar.register -- delegate to the workbench status bar registry
    this.handlers.set("statusBar.register", (params: unknown) => {
      const sbParams = params as {
        id: string;
        side: "left" | "right";
        priority: number;
      };
      const dispose = statusBarRegistry.register({
        id: sbParams.id,
        side: sbParams.side,
        priority: sbParams.priority,
        render: () => null, // Render function cannot cross iframe boundary
      });
      this.disposables.push(dispose);
      return { registered: true };
    });

    // sidebar.register -- store contribution data
    this.handlers.set("sidebar.register", (params: unknown) => {
      this.sidebarContributions.push(params);
      return { registered: true };
    });

    // storage.get -- read from plugin-scoped store
    this.handlers.set("storage.get", (params: unknown) => {
      const { key } = params as { key: string };
      return this.storage.get(key);
    });

    // storage.set -- write to plugin-scoped store
    this.handlers.set("storage.set", (params: unknown) => {
      const { key, value } = params as { key: string; value: unknown };
      this.storage.set(key, value);
      return undefined;
    });

    // network.fetch -- domain-scoped fetch proxy
    this.handlers.set(
      "network.fetch",
      async (params: unknown) => {
        const { url, options: fetchOptions } = params as {
          url: string;
          options?: RequestInit;
        };

        // Check domain against network permission allowlists
        const allAllowedDomains = this.networkPermissions.flatMap(
          (np) => np.allowedDomains,
        );

        if (!checkNetworkPermission(url, allAllowedDomains)) {
          throw new PermissionDeniedError(
            `Plugin "${this.pluginId}" network fetch denied for "${url}" -- domain not in allowedDomains`,
          );
        }

        // Proxy the fetch on behalf of the plugin
        const response = await fetch(url, fetchOptions);
        const body = await response.text();
        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body,
        };
      },
    );
  }

  /**
   * Send a successful response to the iframe.
   */
  private sendResponse(id: string, result: unknown): void {
    const response: BridgeResponse = { id, type: "response", result };
    this.targetWindow.postMessage(response, "*");
  }

  /**
   * Send an error response to the iframe.
   */
  private sendError(
    id: string,
    code: BridgeErrorCode,
    message: string,
  ): void {
    const response: BridgeErrorResponse = {
      id,
      type: "error",
      error: { code, message },
    };
    this.targetWindow.postMessage(response, "*");
  }
}
