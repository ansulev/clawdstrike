/**
 * Plugin Manifest Types
 *
 * Defines the PluginManifest contract and all contribution point interfaces
 * for the ClawdStrike plugin ecosystem. Ported from the Athas ExtensionManifest
 * pattern, with language-specific fields replaced by security-domain contribution
 * points (guards, detection adapters, intel sources, compliance frameworks).
 *
 * All downstream systems (registry, loader, SDK) depend on these types.
 */

import type { ConfigFieldDef } from "../workbench/types";

// Re-export ConfigFieldDef for convenience so downstream consumers
// can import everything from this module
export type { ConfigFieldDef } from "../workbench/types";

// ---- Trust & Lifecycle ----

/**
 * Plugin trust tier determines loading strategy:
 * - "internal": built-in plugins, loaded in-process with full access
 * - "community": third-party plugins, loaded in sandboxed iframe
 * - "mcp": MCP tool plugins, loaded via MCP protocol bridge
 */
export type PluginTrustTier = "internal" | "community" | "mcp";

/**
 * Plugin lifecycle state machine:
 * not-installed -> installing -> installed -> activating -> activated
 *                                         -> deactivated
 *                                         -> error
 */
export type PluginLifecycleState =
  | "not-installed"
  | "installing"
  | "installed"
  | "activating"
  | "activated"
  | "deactivated"
  | "revoked"
  | "error";

// ---- Categories ----

/**
 * Plugin category. Open string type for extensibility.
 * Use BUILTIN_PLUGIN_CATEGORIES for well-known categories.
 */
export type PluginCategory = string;

/** Well-known plugin categories for the ClawdStrike security workbench. */
export const BUILTIN_PLUGIN_CATEGORIES = [
  "guards",
  "detection",
  "intel",
  "compliance",
  "ui",
  "integration",
] as const;

export type BuiltinPluginCategory = (typeof BUILTIN_PLUGIN_CATEGORIES)[number];

// ---- Activation Events ----

/**
 * Activation event string. Determines when the plugin is activated.
 *
 * Known patterns:
 * - `"onStartup"` — activate immediately on workbench load
 * - `"onFileType:{type}"` — activate when a file of the given type is opened
 * - `"onCommand:{id}"` — activate when a specific command is invoked
 * - `"onGuardEvaluate:{id}"` — activate when a specific guard is evaluated
 */
export type ActivationEvent = string;

// ---- Contribution Point Interfaces ----

/**
 * Guard contribution declares a custom guard to register in the guard pipeline.
 * Fields mirror GuardMeta from workbench/types.ts.
 */
export interface GuardContribution {
  /** Guard ID to register in the guard registry. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Technical/snake_case name for policy YAML keys. */
  technicalName: string;
  /** Description of what this guard checks. */
  description: string;
  /** Guard category (e.g. "filesystem", "network", "content"). */
  category: string;
  /** Default verdict when the guard triggers. */
  defaultVerdict: "allow" | "deny" | "warn";
  /** Icon identifier for UI rendering. */
  icon: string;
  /** Configuration field definitions for the guard config UI. */
  configFields: ConfigFieldDef[];
}

/**
 * Command contribution declares a command to register in the command palette.
 */
export interface CommandContribution {
  /** Unique command identifier (e.g. "myPlugin.runScan"). */
  id: string;
  /** Display title in the command palette. */
  title: string;
  /** Optional category for grouping in the palette. */
  category?: string;
  /** Optional default keyboard shortcut (e.g. "Cmd+Shift+S"). */
  shortcut?: string;
  /** Optional contextual visibility expression (for future use). */
  when?: string;
}

/**
 * Keybinding contribution binds a keyboard shortcut to a command.
 */
export interface KeybindingContribution {
  /** Command ID to bind. */
  command: string;
  /** Key combination (e.g. "Cmd+Shift+S", "Ctrl+K"). */
  key: string;
  /** Optional contextual activation expression. */
  when?: string;
}

/**
 * File type contribution declares a new detection engineering file format.
 * Fields mirror FileTypeDescriptor from workbench/file-type-registry.ts.
 */
export interface FileTypeContribution {
  /** Unique file type identifier. */
  id: string;
  /** Human-readable label (e.g. "Splunk SPL Rule"). */
  label: string;
  /** Short label for compact UI (e.g. "SPL"). */
  shortLabel: string;
  /** Associated file extensions (lowercase, with leading dot). */
  extensions: string[];
  /** Hex color for tab dots and explorer icons. */
  iconColor: string;
  /** Template content for new file creation. */
  defaultContent: string;
  /** Whether this format supports the test runner. */
  testable: boolean;
}

/**
 * Detection adapter contribution provides a detection format adapter
 * (e.g., Splunk SPL, KQL, Elastic ESQL).
 */
export interface DetectionAdapterContribution {
  /** File type this adapter handles. */
  fileType: string;
  /** Path to the adapter module within the plugin package. */
  entrypoint: string;
}

/**
 * Activity bar item contribution adds an entry to the left sidebar navigation.
 */
export interface ActivityBarItemContribution {
  /** Unique identifier for this activity bar item. */
  id: string;
  /** Sidebar section name (e.g. "security", "analysis"). */
  section: string;
  /** Display label. */
  label: string;
  /** Icon identifier (Lucide icon name or custom). */
  icon: string;
  /** Route path for navigation. */
  href: string;
  /** Sort order within the section. Lower numbers appear first. */
  order?: number;
}

/**
 * Editor tab contribution declares a custom tab/view that can be opened in the editor pane area.
 */
export interface EditorTabContribution {
  /** Unique identifier for this tab type. */
  id: string;
  /** Display label for the tab. */
  label: string;
  /** Optional icon identifier. */
  icon?: string;
  /** Path to the tab component module within the plugin package. */
  entrypoint: string;
}

/**
 * Bottom panel tab contribution adds a tab to the bottom panel (terminal, output, problems area).
 */
export interface BottomPanelTabContribution {
  /** Unique identifier for this panel tab. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional icon identifier. */
  icon?: string;
  /** Path to the panel component module within the plugin package. */
  entrypoint: string;
}

/**
 * Right sidebar panel contribution adds a panel to the right sidebar.
 */
export interface RightSidebarPanelContribution {
  /** Unique identifier for this panel. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional icon identifier. */
  icon?: string;
  /** Path to the panel component module within the plugin package. */
  entrypoint: string;
}

/**
 * Status bar item contribution adds a segment to the bottom status bar.
 */
export interface StatusBarItemContribution {
  /** Unique identifier for this status bar item. */
  id: string;
  /** Which side of the status bar ("left" or "right"). */
  side: "left" | "right";
  /** Sort order within the side. Lower numbers render first. */
  priority: number;
  /** Path to the render component module within the plugin package. */
  entrypoint: string;
}

/**
 * Threat intel source contribution provides an external threat intelligence feed.
 */
export interface ThreatIntelSourceContribution {
  /** Unique identifier for this intel source. */
  id: string;
  /** Human-readable name (e.g. "VirusTotal", "AbuseIPDB"). */
  name: string;
  /** Description of the intel source. */
  description: string;
  /** Path to the source adapter module within the plugin package. */
  entrypoint: string;
}

/**
 * Compliance framework contribution provides compliance mapping definitions
 * (e.g., HIPAA, SOC 2, PCI-DSS, NIST 800-53).
 */
export interface ComplianceFrameworkContribution {
  /** Unique identifier for this framework. */
  id: string;
  /** Human-readable name (e.g. "NIST 800-53"). */
  name: string;
  /** Description of the compliance framework. */
  description: string;
  /** Path to the framework definition module within the plugin package. */
  entrypoint: string;
}

// ---- Gutter Decoration Contribution ----

/** Gutter decoration contribution -- provides a CodeMirror Extension factory. */
export interface GutterDecorationContribution {
  /** Unique identifier for this gutter decoration. */
  id: string;
  /** Optional gutter name (defaults to a plugin-namespaced custom gutter). */
  gutter?: string;
  /** Module path exporting a createGutterExtension(config: GutterConfig) => Extension factory. */
  entrypoint: string;
}

/** Configuration passed to a plugin's gutter extension factory. */
export interface GutterConfig {
  /** The plugin's qualified ID. */
  pluginId: string;
  /** The gutter decoration's qualified ID. */
  decorationId: string;
}

// ---- Contributions Container ----

/**
 * All contribution point declarations grouped by type.
 * Each field is optional — a plugin may contribute to any subset of points.
 */
export interface PluginContributions {
  /** Custom guard definitions for the guard pipeline. */
  guards?: GuardContribution[];
  /** Commands for the command palette. */
  commands?: CommandContribution[];
  /** Keyboard shortcut bindings. */
  keybindings?: KeybindingContribution[];
  /** Custom detection engineering file types. */
  fileTypes?: FileTypeContribution[];
  /** Detection format adapters. */
  detectionAdapters?: DetectionAdapterContribution[];
  /** Left sidebar navigation items. */
  activityBarItems?: ActivityBarItemContribution[];
  /** Custom editor tab/view types. */
  editorTabs?: EditorTabContribution[];
  /** Bottom panel tabs. */
  bottomPanelTabs?: BottomPanelTabContribution[];
  /** Right sidebar panels. */
  rightSidebarPanels?: RightSidebarPanelContribution[];
  /** Status bar segments. */
  statusBarItems?: StatusBarItemContribution[];
  /** Threat intelligence feed sources. */
  threatIntelSources?: ThreatIntelSourceContribution[];
  /** Compliance framework definitions. */
  complianceFrameworks?: ComplianceFrameworkContribution[];
  /** CodeMirror gutter decoration extensions. */
  gutterDecorations?: GutterDecorationContribution[];
}

// ---- Contribution Point Keys ----

/** All known contribution point keys, in sync with PluginContributions fields. */
export const CONTRIBUTION_POINT_KEYS = [
  "guards",
  "commands",
  "keybindings",
  "fileTypes",
  "detectionAdapters",
  "activityBarItems",
  "editorTabs",
  "bottomPanelTabs",
  "rightSidebarPanels",
  "statusBarItems",
  "threatIntelSources",
  "complianceFrameworks",
  "gutterDecorations",
] as const;

/** Union type of all contribution point key strings. */
export type ContributionPointType = (typeof CONTRIBUTION_POINT_KEYS)[number];

// ---- Permissions ----

/**
 * Permission string declaring a capability a plugin needs.
 * Uses "scope:action" format (colon separator).
 *
 * Categories:
 * - Registry: guards, commands, fileTypes, statusBar, sidebar
 * - Data: storage, policy
 * - Network: network
 * - System: clipboard, notifications
 */
export type PluginPermission =
  // Registry
  | "guards:register"
  | "guards:read"
  | "commands:register"
  | "commands:execute"
  | "fileTypes:register"
  | "statusBar:register"
  | "sidebar:register"
  // Data
  | "storage:read"
  | "storage:write"
  | "policy:read"
  | "policy:write"
  // Network
  | "network:fetch"
  // System
  | "clipboard:read"
  | "clipboard:write"
  | "notifications:show";

/**
 * Structured network permission with domain allowlist.
 * Used when a plugin needs network access restricted to specific domains.
 */
export interface NetworkPermission {
  /** Must be "network:fetch" to identify this as a network permission. */
  type: "network:fetch";
  /** List of domains the plugin is allowed to fetch from. */
  allowedDomains: string[];
  /** Optional list of allowed HTTP methods (e.g. ["GET", "POST"]). */
  methods?: string[];
}

// ---- Installation Metadata ----

/**
 * Distribution and installation metadata for a plugin package.
 * Includes integrity fields for secure distribution.
 */
export interface InstallationMetadata {
  /** URL to download the plugin package. */
  downloadUrl: string;
  /** Package size in bytes. */
  size: number;
  /** SHA-256 hex digest of the package contents. */
  checksum: string;
  /** Ed25519 signature of the canonical manifest JSON. */
  signature: string;
  /** Minimum compatible workbench version (semver). */
  minWorkbenchVersion?: string;
  /** Maximum compatible workbench version (semver). */
  maxWorkbenchVersion?: string;
}

// ---- Plugin Manifest ----

/**
 * The PluginManifest is the contract that describes what a plugin provides.
 * It declares identity, trust level, contribution points, activation triggers,
 * and distribution metadata. All downstream systems (registry, loader, SDK)
 * depend on this type.
 */
export interface PluginManifest {
  /** Reverse-domain plugin identifier (e.g. "clawdstrike.egress-guard"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Display name for UI rendering. */
  displayName: string;
  /** Plugin description. */
  description: string;
  /** Semantic version string (e.g. "1.0.0", "2.1.0-beta.1"). */
  version: string;
  /** Publisher name or organization. */
  publisher: string;
  /** Plugin categories for filtering and discovery. */
  categories: PluginCategory[];
  /** Trust tier determines loading strategy and sandbox level. */
  trust: PluginTrustTier;
  /** Events that trigger plugin activation. */
  activationEvents: ActivationEvent[];
  /** Entry point path for plugin code (relative to plugin root). */
  main?: string;
  /** All contribution point declarations. */
  contributions?: PluginContributions;
  /** Distribution and installation metadata. */
  installation?: InstallationMetadata;
  /**
   * Declared permissions (capabilities) the plugin requires.
   * Community plugins must declare all needed permissions; undeclared
   * API calls are rejected with PERMISSION_DENIED (fail-closed).
   */
  permissions?: (PluginPermission | NetworkPermission)[];
}

// ---- Registered Plugin ----

/**
 * A plugin tracked by the PluginRegistry, combining the manifest
 * with runtime lifecycle state. Used by Plan 02-02 (PluginRegistry).
 */
export interface RegisteredPlugin {
  /** The plugin's manifest declaration. */
  manifest: PluginManifest;
  /** Current lifecycle state. */
  state: PluginLifecycleState;
  /** Error message if state is "error". */
  error?: string;
  /** Timestamp (epoch ms) when the plugin was activated. */
  activatedAt?: number;
  /** Timestamp (epoch ms) when the plugin was installed. */
  installedAt?: number;
}
