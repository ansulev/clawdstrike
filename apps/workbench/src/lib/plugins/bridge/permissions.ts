/**
 * Bridge Permission Mapping
 *
 * Maps every bridge method string (dot notation, e.g. "guards.register") to
 * the PluginPermission string (colon notation, e.g. "guards:register") that
 * a plugin must declare to invoke that method.
 *
 * The checkPermission function is the single enforcement point: it looks up
 * the required permission for a method and checks whether the plugin has
 * declared it. Unknown methods are denied (fail-closed).
 */

import type { PluginPermission } from "../types";

/**
 * Maps every bridge method string to the PluginPermission required to call it.
 *
 * Bridge methods use dot notation (e.g. "guards.register").
 * Permissions use colon notation (e.g. "guards:register").
 */
export const METHOD_TO_PERMISSION: Record<string, PluginPermission> = {
  "commands.register": "commands:register",
  "guards.register": "guards:register",
  "fileTypes.register": "fileTypes:register",
  "statusBar.register": "statusBar:register",
  "sidebar.register": "sidebar:register",
  "storage.get": "storage:read",
  "storage.set": "storage:write",
};

/**
 * Check whether a plugin with the given granted permissions is allowed
 * to call the specified bridge method.
 *
 * Returns false if:
 * - The method has no entry in METHOD_TO_PERMISSION (unknown method, fail-closed)
 * - The required permission is not in the granted set
 *
 * @param grantedPermissions - Set of permission strings the plugin declared
 * @param method - Bridge method name (dot notation, e.g. "guards.register")
 * @returns true if the call is allowed, false otherwise
 */
export function checkPermission(
  grantedPermissions: Set<string>,
  method: string,
): boolean {
  const required = METHOD_TO_PERMISSION[method];
  if (!required) {
    return false; // Unknown method -- fail-closed
  }
  return grantedPermissions.has(required);
}
