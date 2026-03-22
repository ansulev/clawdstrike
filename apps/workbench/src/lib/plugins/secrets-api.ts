/**
 * Secrets API Factory
 *
 * Creates a plugin-scoped SecretsApi that automatically prefixes all keys
 * with `plugin:{pluginId}:` and delegates to the workbench secureStore.
 * This ensures plugins cannot read/write each other's credentials.
 */

import { secureStore } from "@/lib/workbench/secure-store";

/** Plugin-scoped secret storage API. */
export interface SecretsApi {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

/**
 * Create a plugin-scoped SecretsApi that auto-prefixes keys with `plugin:{pluginId}:`.
 * Delegates all operations to the workbench secureStore.
 */
export function createSecretsApi(pluginId: string): SecretsApi {
  const prefix = `plugin:${pluginId}:`;
  return {
    get: (key) => secureStore.get(`${prefix}${key}`),
    set: (key, value) => secureStore.set(`${prefix}${key}`, value),
    delete: (key) => secureStore.delete(`${prefix}${key}`),
    has: (key) => secureStore.has(`${prefix}${key}`),
  };
}
