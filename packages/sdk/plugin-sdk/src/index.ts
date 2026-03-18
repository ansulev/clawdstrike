/**
 * @clawdstrike/plugin-sdk
 *
 * Public API surface for ClawdStrike plugin authors.
 *
 * Usage:
 * ```typescript
 * import { createPlugin, type PluginContext } from '@clawdstrike/plugin-sdk';
 *
 * export default createPlugin({
 *   manifest: { id: "my.plugin", name: "my-plugin", ... },
 *   activate(ctx) {
 *     ctx.commands.register({ id: "my.command", title: "My Command" }, () => { ... });
 *   },
 * });
 * ```
 */

// ---- Types ----
export type {
  // Disposable
  Disposable,
  // Trust & Lifecycle
  PluginTrustTier,
  PluginLifecycleState,
  // Categories & Activation
  PluginCategory,
  ActivationEvent,
  // Config
  ConfigFieldType,
  ConfigFieldDef,
  // Contribution Points (all 12)
  GuardContribution,
  CommandContribution,
  KeybindingContribution,
  FileTypeContribution,
  DetectionAdapterContribution,
  ActivityBarItemContribution,
  EditorTabContribution,
  BottomPanelTabContribution,
  RightSidebarPanelContribution,
  StatusBarItemContribution,
  ThreatIntelSourceContribution,
  ComplianceFrameworkContribution,
  // Contributions Container
  PluginContributions,
  // Installation & Manifest
  InstallationMetadata,
  PluginManifest,
} from "./types";

// ---- Context ----
export type {
  CommandsApi,
  GuardsApi,
  FileTypesApi,
  StatusBarApi,
  SidebarApi,
  StorageApi,
  PluginContext,
} from "./context";

// ---- Factory ----
export { createPlugin } from "./create-plugin";
export type { PluginDefinition } from "./create-plugin";
