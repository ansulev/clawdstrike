/**
 * Bridge Module Barrel Export
 *
 * Re-exports the complete bridge public API: client, host, error class,
 * protocol types, constants, and type guard.
 */

export { PluginBridgeClient, BridgeError } from "./bridge-client";
export { PluginBridgeHost } from "./bridge-host";
export type { BridgeHandler, BridgeHostOptions } from "./bridge-host";
export {
  checkPermission,
  METHOD_TO_PERMISSION,
  KNOWN_PERMISSIONS,
  checkNetworkPermission,
  extractNetworkPermissions,
} from "./permissions";
export type {
  BridgeMessage,
  BridgeRequest,
  BridgeResponse,
  BridgeEvent,
  BridgeErrorResponse,
  BridgeErrorCode,
  BridgeMethodName,
} from "./types";
export { BRIDGE_METHODS, BRIDGE_TIMEOUT_MS, isBridgeMessage } from "./types";
