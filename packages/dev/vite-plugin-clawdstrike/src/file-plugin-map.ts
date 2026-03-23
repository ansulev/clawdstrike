import { resolve, normalize } from 'path';

/**
 * Bidirectional mapping from file paths to plugin IDs using
 * directory-prefix matching. Longest prefix wins for nested plugins.
 */
export class FilePluginMap {
  private dirToPluginId = new Map<string, string>();
  private pluginIdToEntry = new Map<string, string>();
  private pluginIdToDir = new Map<string, string>();

  register(pluginId: string, dir: string, entry?: string): void {
    const normalizedDir = this.normalizeDir(dir);
    this.dirToPluginId.set(normalizedDir, pluginId);
    this.pluginIdToDir.set(pluginId, normalizedDir);

    const entryFile = entry ?? 'src/index.ts';
    const entryPath = resolve(normalizedDir, entryFile);
    this.pluginIdToEntry.set(pluginId, entryPath);
  }

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

  getEntry(pluginId: string): string | undefined {
    return this.pluginIdToEntry.get(pluginId);
  }

  getPluginDir(pluginId: string): string | undefined {
    return this.pluginIdToDir.get(pluginId);
  }

  private normalizeDir(dir: string): string {
    const normalized = normalize(dir);
    return normalized.endsWith('/') ? normalized : `${normalized}/`;
  }
}
