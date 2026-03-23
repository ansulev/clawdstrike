/**
 * Playground Runner
 *
 * Orchestrates the full cycle of running a playground plugin:
 * transpile -> post to eval server -> dynamic import -> register -> activate.
 *
 * Also provides a console proxy that intercepts console output from the
 * playground plugin and routes it to the playground store.
 */
import { createPlugin } from "@clawdstrike/plugin-sdk";
import { transpilePlugin } from "./playground-transpiler";
import {
  getPlaygroundState,
  setRunning,
  clearErrors,
  incrementRunCount,
  addError,
  setTranspiled,
  setContributions,
  setLastRunTimestamp,
  addConsoleEntry,
} from "./playground-store";
import type { PlaygroundError, ContributionSnapshot } from "./playground-store";
import { pluginLoader } from "../plugin-loader";
import { pluginRegistry } from "../plugin-registry";
import { clearSnapshot } from "../dev/storage-snapshot";
import type { PluginManifest } from "../types";

// ---------------------------------------------------------------------------
// Window augmentation for playground globals
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __PLAYGROUND_CONSOLE__?: Record<string, (...args: unknown[]) => void>;
    __CLAWDSTRIKE_PLUGIN_SDK__?: { createPlugin: typeof createPlugin };
    __PLAYGROUND_PLUGIN__?: {
      manifest?: PluginManifest;
      activate?: unknown;
      deactivate?: unknown;
    };
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAYGROUND_PLUGIN_ID = "__playground__";

// ---------------------------------------------------------------------------
// Console proxy
// ---------------------------------------------------------------------------

/**
 * Set up a console proxy that intercepts console.log/warn/error/info
 * and routes them to the playground store as ConsoleEntry items.
 *
 * Returns a cleanup function that restores the original console.
 */
export function setupConsoleProxy(): () => void {
  const proxy: Record<string, (...args: unknown[]) => void> = {};
  const levels = ["log", "warn", "error", "info"] as const;

  for (const level of levels) {
    proxy[level] = (...args: unknown[]) => {
      // Also call the real console so DevTools still works
      // eslint-disable-next-line no-console
      console[level](...args);
      addConsoleEntry({
        level,
        args,
        timestamp: Date.now(),
      });
    };
  }

  // Expose the proxy globally for the transpiled plugin code
  window.__PLAYGROUND_CONSOLE__ = proxy;

  return () => {
    delete window.__PLAYGROUND_CONSOLE__;
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run the current playground plugin source code.
 *
 * Steps:
 * 1. Read source from store
 * 2. Transpile TS to JS
 * 3. POST transpiled code to /__plugin-eval/
 * 4. Deactivate previous playground plugin if loaded
 * 5. Set window.__CLAWDSTRIKE_PLUGIN_SDK__ for the transpiled code
 * 6. Dynamic import the eval URL
 * 7. Read window.__PLAYGROUND_PLUGIN__ as PluginDefinition
 * 8. Register manifest in pluginRegistry
 * 9. Load via pluginLoader
 * 10. Build ContributionSnapshot
 */
export async function runPlaygroundPlugin(): Promise<void> {
  // 1. Read source
  const { source, runCount } = getPlaygroundState();
  const currentRunCount = runCount + 1; // will be incremented below

  // 2. Set state
  setRunning(true);
  clearErrors();
  incrementRunCount();

  // Set up console proxy
  const cleanupConsole = setupConsoleProxy();

  try {
    // 3. Transpile
    const { code, error } = transpilePlugin(source);
    if (error) {
      addError(error);
      setRunning(false);
      cleanupConsole();
      return;
    }

    setTranspiled(code);

    // 4. POST to eval server
    const response = await fetch("/__plugin-eval/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, runId: currentRunCount }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: "Failed to store code" }));
      addError({ message: (errBody as { error?: string }).error ?? "Eval server error" });
      setRunning(false);
      cleanupConsole();
      return;
    }

    const { url: evalUrl } = (await response.json()) as { url: string };

    // 5. Deactivate previous playground plugin if loaded
    try {
      const existing = pluginRegistry.get(PLAYGROUND_PLUGIN_ID);
      if (existing) {
        await pluginLoader.deactivatePlugin(PLAYGROUND_PLUGIN_ID);
        pluginRegistry.unregister(PLAYGROUND_PLUGIN_ID);
      }
    } catch {
      // Best-effort cleanup of previous instance
    }

    // 5b. Clear any accumulated storage from previous runs
    clearSnapshot(PLAYGROUND_PLUGIN_ID);

    // 6. Set window.__CLAWDSTRIKE_PLUGIN_SDK__
    window.__CLAWDSTRIKE_PLUGIN_SDK__ = { createPlugin };

    // 7. Dynamic import the eval URL
    // Clear previous plugin reference
    delete window.__PLAYGROUND_PLUGIN__;
    await import(/* @vite-ignore */ evalUrl);

    // 8. Read the plugin definition
    // Re-read from window after dynamic import has populated the global.
    // TypeScript control-flow narrows __PLAYGROUND_PLUGIN__ to never after
    // the delete above, so we read via bracket notation to bypass narrowing.
    type PluginDefShape = { manifest?: PluginManifest; activate?: unknown; deactivate?: unknown };
    const pluginDef = (window as unknown as Record<string, PluginDefShape | undefined>).__PLAYGROUND_PLUGIN__;
    const defManifest = pluginDef?.manifest;

    if (!defManifest) {
      addError({
        message: "Plugin did not export a valid definition. Make sure your plugin uses: export default createPlugin({ ... })",
      });
      setRunning(false);
      cleanupConsole();
      return;
    }

    // Override the manifest ID to our known playground ID
    const manifest: PluginManifest = {
      ...defManifest,
      id: PLAYGROUND_PLUGIN_ID,
      trust: "internal",
    };

    // 9. Register in plugin registry
    pluginRegistry.register(manifest);

    // 10. Load via plugin loader
    await pluginLoader.loadPlugin(PLAYGROUND_PLUGIN_ID);

    // 11. Build contribution snapshot
    const contributions = manifest.contributions;
    const snapshot: ContributionSnapshot = {
      guards: contributions?.guards?.map((g) => g.name ?? g.id) ?? [],
      commands: contributions?.commands?.map((c) => c.title ?? c.id) ?? [],
      fileTypes: contributions?.fileTypes?.map((f) => f.label ?? f.id) ?? [],
      editorTabs: contributions?.editorTabs?.map((t) => t.label ?? t.id) ?? [],
      bottomPanelTabs: contributions?.bottomPanelTabs?.map((t) => t.label ?? t.id) ?? [],
      rightSidebarPanels: contributions?.rightSidebarPanels?.map((p) => p.label ?? p.id) ?? [],
      statusBarItems: contributions?.statusBarItems?.map((s) => s.id) ?? [],
    };
    setContributions(snapshot);
    setLastRunTimestamp(Date.now());
    setRunning(false);
  } catch (err: unknown) {
    const playgroundError: PlaygroundError = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    };
    addError(playgroundError);
    setRunning(false);
    cleanupConsole();
  }
}
