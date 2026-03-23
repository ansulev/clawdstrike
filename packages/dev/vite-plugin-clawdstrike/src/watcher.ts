import { resolve } from 'path';
import type { ViteDevServer } from 'vite';
import type { ClawdstrikePluginOptions } from './types';
import { PLUGIN_UPDATE_EVENT } from './types';
import type { PluginUpdateEvent } from './types';
import { FilePluginMap } from './file-plugin-map';

/**
 * Set up file watching for plugin directories.
 *
 * For each plugin entry in options, registers the directory in the
 * FilePluginMap and adds it to Vite's chokidar watcher. On file
 * changes, resolves the affected plugin and sends a custom HMR
 * WebSocket event with the plugin ID, entry path, and timestamp.
 */
export function setupPluginWatcher(
  server: ViteDevServer,
  fileMap: FilePluginMap,
  options: ClawdstrikePluginOptions,
): void {
  // Register all plugin directories
  for (const plugin of options.plugins) {
    const absoluteDir = resolve(plugin.dir);
    fileMap.register(plugin.pluginId, absoluteDir, plugin.entry);

    // Add directory to Vite's chokidar watch list
    server.watcher.add(absoluteDir);

    console.log(`[clawdstrike] Watching plugin: ${plugin.pluginId} at ${absoluteDir}`);
  }

  // Handle file changes
  const handleFileChange = (filePath: string): void => {
    const pluginId = fileMap.resolve(filePath);
    if (!pluginId) {
      return; // File is not part of any registered plugin
    }

    const entryPath = fileMap.getEntry(pluginId);
    if (!entryPath) {
      return; // Should not happen if resolve() returned a pluginId
    }

    const payload: PluginUpdateEvent = {
      pluginId,
      entryPath,
      timestamp: Date.now(),
    };

    server.ws.send(PLUGIN_UPDATE_EVENT, payload);
  };

  // Listen for file changes and additions
  server.watcher.on('change', handleFileChange);
  server.watcher.on('add', handleFileChange);
}
