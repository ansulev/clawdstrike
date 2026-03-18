# Athas Extension System — Reference Implementation

## Overview

Athas has a complete extension system across 4 key files (~1200 LOC) that ClawdStrike should port and adapt. It's focused on language support (LSP, formatters, linters, grammars) which ClawdStrike would replace with security-domain contribution points (guards, detection adapters, intel sources).

## ExtensionManifest (355 LOC)

**File:** `src/extensions/types/extension-manifest.ts`

Core interface:
```typescript
interface ExtensionManifest {
  id: string;           // "athas.rust"
  name: string;         // "Rust"
  displayName: string;  // "Rust Language Support"
  description: string;
  version: string;
  publisher: string;
  categories: ExtensionCategory[];

  // Contribution points
  languages?: LanguageContribution[];
  lsp?: LspConfiguration;
  grammar?: GrammarConfiguration;
  formatter?: FormatterConfiguration;
  linter?: LinterConfiguration;
  snippets?: SnippetContribution[];
  commands?: CommandContribution[];
  keybindings?: KeybindingContribution[];

  // Lifecycle
  activationEvents?: string[];
  main?: string;           // Entry point for custom code
  installation?: InstallationMetadata;
}
```

**Key types for ClawdStrike adaptation:**

| Athas Type | ClawdStrike Equivalent |
|---|---|
| `LanguageContribution` | `FileTypeContribution` (policy, sigma, yara, ocsf + custom) |
| `LspConfiguration` | Not needed (CodeMirror, not LSP) |
| `GrammarConfiguration` | Not needed (CodeMirror language modes) |
| `FormatterConfiguration` | `GuardConfiguration` (guard plugin definition) |
| `LinterConfiguration` | `DetectionAdapterConfiguration` |
| `SnippetContribution` | `PolicyTemplateContribution` |
| `CommandContribution` | Same (reuse as-is) |
| `KeybindingContribution` | Same (reuse as-is) |

**New contribution points for ClawdStrike:**
- `guards` — custom guard definitions
- `detectionAdapters` — format adapters (Splunk SPL, KQL, etc.)
- `threatIntelSources` — enrichment providers
- `complianceFrameworks` — compliance mapping definitions
- `activityBarItems` — sidebar panel contributions
- `editorTabs` — pane-openable views
- `bottomPanelTabs` — bottom panel contributions
- `rightSidebarPanels` — right sidebar contributions
- `statusBarItems` — status bar segments

**InstallationMetadata:**
```typescript
interface InstallationMetadata {
  downloadUrl: string;
  size: number;
  checksum: string;           // SHA256
  minEditorVersion?: string;
  maxEditorVersion?: string;
  platformArch?: Partial<Record<PlatformArch, PlatformPackage>>;
}
```

ClawdStrike should add: `signature: string` (Ed25519 sig of manifest) and `receipt?: string` (installation receipt ID).

## ExtensionRegistry (565 LOC)

**File:** `src/extensions/registry/extension-registry.ts`

Singleton class pattern:
```typescript
class ExtensionRegistry {
  private extensions = new Map<string, BundledExtension>();
  private activatedExtensions = new Set<string>();

  registerExtension(manifest, options): void    // Add or update
  unregisterExtension(extensionId): void        // Remove
  getAllExtensions(): BundledExtension[]         // List all
  getExtension(id): BundledExtension | undefined // Lookup
  getExtensionForFilePath(path): BundledExtension | undefined // Route files
  setExtensionState(id, state): void            // Lifecycle tracking
  isExtensionActivated(id): boolean             // Check state
}

export const extensionRegistry = new ExtensionRegistry(); // Singleton
```

**Key patterns to port:**
1. `Map<string, BundledExtension>` for O(1) lookup by ID
2. File path routing: `getExtensionForFilePath()` checks filenames first, then extensions
3. State lifecycle: not-installed → installing → installed → activating → activated → deactivated
4. Platform-aware tool resolution (server paths, formatter commands per OS)
5. Async initialization with `ensureInitialized()` gate

**What ClawdStrike adds:**
- Trust tier tracking (`internal | community | mcp`)
- Signature verification on registration
- Permission declarations (what APIs the plugin can access)
- Activation event matching against current context

## ExtensionLoader (333 LOC)

**File:** `src/extensions/loader/extension-loader.ts`

Bridges registry (manifests) with runtime (lifecycle):
```typescript
class ExtensionLoader {
  private loadedExtensions = new Set<string>();

  async initialize(): Promise<void>           // Load all registered
  private async loadExtension(ext): Promise<void>  // Load single
  isExtensionLoaded(id): boolean
}

export const extensionLoader = new ExtensionLoader(); // Singleton
```

**Key patterns:**
1. `Promise.allSettled()` for parallel loading (failures don't block others)
2. `GenericLspExtension` class wraps any manifest into a loadable instance
3. Bridge pattern: converts manifest format to runtime format (`extensionManager.loadNewExtension()`)
4. Dummy editor API for pre-mount initialization

**ClawdStrike adaptation:**
- Replace `GenericLspExtension` with `GenericPluginExtension` that handles:
  - Guard registration (push to guard pipeline)
  - Detection adapter registration (push to adapter registry)
  - UI contribution registration (push to activity bar, pane, bottom panel stores)
  - Command registration (push to command registry)
- Add trust verification before loading (check Ed25519 signature)
- Add iframe sandbox creation for community plugins

## Extension Store (Zustand)

Not directly read but referenced. Uses Zustand with persist middleware to track:
- `availableExtensions: Map<string, AvailableExtension>`
- `installedExtensions: Map<string, InstallationMetadata>`
- `extensionsWithUpdates: Set<string>`
- Actions: `loadAvailable`, `install`, `uninstall`, `checkForUpdates`

**ClawdStrike should mirror this** for the plugin marketplace/catalog UI in the Library sidebar panel.

## Architecture Summary

```
ExtensionManifest (types)
    ↓ declares
ExtensionRegistry (singleton Map)
    ↓ loaded by
ExtensionLoader (lifecycle bridge)
    ↓ registers into
ExtensionManager (runtime host)
    ↓ manages
Running Extensions (activated instances)
```

ClawdStrike equivalent:
```
PluginManifest (types)
    ↓ declares
PluginRegistry (singleton Map + trust verification)
    ↓ loaded by
PluginLoader (lifecycle bridge + sandbox creation)
    ↓ registers into
PluginHost (runtime — in-process or iframe)
    ↓ contributes to
CommandRegistry, ActivityBarStore, PaneStore, GuardPipeline, etc.
```
