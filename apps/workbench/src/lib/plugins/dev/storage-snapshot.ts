/**
 * Storage Snapshot
 *
 * Maintains a write-through cache of plugin storage entries for
 * preservation across HMR reloads. The HMR handler uses this to
 * capture storage state before deactivation and restore it after
 * reactivation, ensuring plugin state survives hot reloads.
 */

/** Module-level cache: pluginId -> (key -> value). */
const devStorageCache = new Map<string, Map<string, unknown>>();

/**
 * Track a storage write for a plugin. Called by the dev-mode storage
 * wrapper whenever a plugin calls `context.storage.set()`.
 */
export function trackStorageWrite(
  pluginId: string,
  key: string,
  value: unknown,
): void {
  let pluginCache = devStorageCache.get(pluginId);
  if (!pluginCache) {
    pluginCache = new Map<string, unknown>();
    devStorageCache.set(pluginId, pluginCache);
  }
  pluginCache.set(key, value);
}

/**
 * Get the current storage snapshot for a plugin.
 * Returns a new Map copy so callers cannot mutate the cache.
 */
export function getSnapshot(pluginId: string): Map<string, unknown> {
  const pluginCache = devStorageCache.get(pluginId);
  if (!pluginCache) {
    return new Map();
  }
  return new Map(pluginCache);
}

/**
 * Restore storage state to a StorageApi instance.
 * Writes all cached entries back via `api.set()`.
 */
export function restoreToApi(
  pluginId: string,
  api: { set(key: string, value: unknown): void },
): void {
  const pluginCache = devStorageCache.get(pluginId);
  if (!pluginCache) {
    return;
  }
  for (const [key, value] of pluginCache) {
    api.set(key, value);
  }
}

/**
 * Clear the storage snapshot for a plugin.
 */
export function clearSnapshot(pluginId: string): void {
  devStorageCache.delete(pluginId);
}
