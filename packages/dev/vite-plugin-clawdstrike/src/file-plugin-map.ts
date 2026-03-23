import { resolve, normalize } from 'path';

/**
 * Bidirectional mapping from file paths to plugin IDs.
 *
 * Uses directory-prefix matching so that any file within a registered
 * plugin directory is automatically mapped to that plugin -- including
 * files created after registration. When multiple directories match
 * (nested plugins), the longest prefix wins.
 */
export class FilePluginMap {
  /** Map from normalized directory path to plugin ID. */
  private dirToPluginId = new Map<string, string>();
  /** Map from plugin ID to the resolved entry file path. */
  private pluginIdToEntry = new Map<string, string>();
  /** Map from plugin ID to the registered directory path. */
  private pluginIdToDir = new Map<string, string>();

  /**
   * Register a plugin directory. All files under `dir` will resolve
   * to `pluginId` via prefix matching.
   *
   * @param pluginId - The plugin's manifest ID.
   * @param dir - The root directory of the plugin source.
   * @param entry - The entry file path (absolute or relative to dir).
   */
  register(pluginId: string, dir: string, entry?: string): void {
    const normalizedDir = this.normalizeDir(dir);
    this.dirToPluginId.set(normalizedDir, pluginId);
    this.pluginIdToDir.set(pluginId, normalizedDir);

    // Resolve entry path -- default to "src/index.ts" relative to dir
    const entryFile = entry ?? 'src/index.ts';
    const entryPath = resolve(normalizedDir, entryFile);
    this.pluginIdToEntry.set(pluginId, entryPath);
  }

  /**
   * Resolve a file path to the plugin ID that owns it.
   *
   * Uses longest-prefix matching on registered directories so that
   * nested plugin directories are handled correctly.
   *
   * @returns The plugin ID, or undefined if the file is not in any registered directory.
   */
  resolve(filePath: string): string | undefined {
    const normalized = normalize(filePath);

    let bestMatch: string | undefined;
    let bestLength = 0;

    for (const [dir, pluginId] of this.dirToPluginId) {
      // Check if the file path starts with the directory path
      if (normalized.startsWith(dir) && dir.length > bestLength) {
        bestMatch = pluginId;
        bestLength = dir.length;
      }
    }

    return bestMatch;
  }

  /**
   * Get the entry file path for a registered plugin.
   */
  getEntry(pluginId: string): string | undefined {
    return this.pluginIdToEntry.get(pluginId);
  }

  /**
   * Get the registered directory for a plugin.
   */
  getPluginDir(pluginId: string): string | undefined {
    return this.pluginIdToDir.get(pluginId);
  }

  /**
   * Normalize a directory path to always end with a path separator,
   * ensuring prefix matching works correctly.
   */
  private normalizeDir(dir: string): string {
    const normalized = normalize(dir);
    // Ensure trailing separator for prefix matching
    return normalized.endsWith('/') ? normalized : `${normalized}/`;
  }
}
