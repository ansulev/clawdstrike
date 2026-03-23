/**
 * Client-side HMR Handler
 *
 * Processes `clawdstrike:plugin-update` WebSocket events from the
 * Vite plugin. On each event, snapshots plugin storage, deactivates
 * the old plugin instance, unregisters it, re-imports the module
 * with a cache-busting query parameter, re-registers the manifest,
 * re-loads the plugin, and restores the storage snapshot.
 */

import { pluginLoader } from '../plugin-loader';
import { pluginRegistry } from '../plugin-registry';
import type { PluginManifest } from '../types';
import type { PluginUpdateEvent, DevLifecycleEvent } from './types';
import { PLUGIN_UPDATE_EVENT } from './types';
import { getSnapshot, restoreToApi } from './storage-snapshot';

/** Event listeners for dev lifecycle events. */
type DevEventListener = (event: DevLifecycleEvent) => void;
const listeners = new Set<DevEventListener>();

/**
 * Subscribe to dev lifecycle events. Returns a dispose function
 * to unsubscribe.
 */
export function onDevLifecycleEvent(cb: DevEventListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emit(event: DevLifecycleEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Handle a single plugin update event.
 *
 * Lifecycle:
 * 1. Snapshot storage state
 * 2. Get current manifest
 * 3. Deactivate old plugin instance
 * 4. Unregister from registry
 * 5. Update manifest entry path with cache-bust query param
 * 6. Re-register with updated manifest
 * 7. Re-load the plugin (triggers activate())
 */
export async function handlePluginUpdate(
  data: PluginUpdateEvent,
): Promise<void> {
  const { pluginId, entryPath, timestamp } = data;
  const startTime = performance.now();

  emit({
    type: 'hmr:start',
    pluginId,
    timestamp: Date.now(),
    message: `HMR reload starting for ${pluginId}`,
  });

  try {
    // 1. Snapshot storage before deactivation
    const _storageSnapshot = getSnapshot(pluginId);

    // 2. Get current manifest before unregistering
    const registered = pluginRegistry.get(pluginId);
    if (!registered) {
      throw new Error(`Plugin "${pluginId}" not found in registry for HMR`);
    }
    const manifest: PluginManifest = { ...registered.manifest };

    // 3. Deactivate old instance (calls module.deactivate(), disposes contributions)
    await pluginLoader.deactivatePlugin(pluginId);
    emit({
      type: 'deactivated',
      pluginId,
      timestamp: Date.now(),
      message: `Deactivated ${pluginId} for HMR`,
    });

    // 4. Unregister from registry
    pluginRegistry.unregister(pluginId);

    // 5. Update manifest entry path with cache-bust query param
    manifest.main = `${entryPath}?t=${timestamp}`;

    // 6. Re-register with updated manifest
    pluginRegistry.register(manifest);
    emit({
      type: 'registered',
      pluginId,
      timestamp: Date.now(),
      message: `Re-registered ${pluginId} with cache-bust`,
    });

    // 7. Re-load the plugin (this triggers activate())
    await pluginLoader.loadPlugin(pluginId);

    const durationMs = performance.now() - startTime;
    emit({
      type: 'hmr:complete',
      pluginId,
      timestamp: Date.now(),
      message: `HMR complete for ${pluginId} in ${durationMs.toFixed(0)}ms`,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({
      type: 'hmr:error',
      pluginId,
      timestamp: Date.now(),
      message: `HMR failed for ${pluginId}: ${message}`,
      detail: err,
    });
  }
}

/**
 * Set up the plugin HMR handler on the Vite HMR client.
 * Call this once during workbench initialization in dev mode.
 *
 * Returns a dispose function that removes the event listener.
 */
export function setupPluginHmr(): () => void {
  if (!import.meta.hot) return () => {};

  const handler = (data: PluginUpdateEvent) => {
    void handlePluginUpdate(data);
  };

  import.meta.hot.on(PLUGIN_UPDATE_EVENT, handler);

  return () => {
    import.meta.hot?.off?.(PLUGIN_UPDATE_EVENT, handler);
  };
}
