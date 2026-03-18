# Guard Pipeline & Detection Adapter Seams for Plugin Integration

**Analysis Date:** 2026-03-18

This document maps every extension point across the Rust guard pipeline, TypeScript SDK guard API, detection workflow adapter system, policy schema, and guard config UI -- with the goal of identifying exactly where plugin-contributed guards and detection adapters plug in.

---

## 1. Guard Pipeline (Rust)

### 1.1 Core Traits

**`Guard` trait** -- `crates/libs/clawdstrike/src/guards/mod.rs:298-308`

```rust
#[async_trait]
pub trait Guard: Send + Sync {
    fn name(&self) -> &str;
    fn handles(&self, action: &GuardAction<'_>) -> bool;
    async fn check(&self, action: &GuardAction<'_>, context: &GuardContext) -> GuardResult;
}
```

- All guards (built-in, custom, plugin-WASM) implement this trait.
- `handles()` is a fast gate; the engine skips guards that return `false`.
- `check()` returns `GuardResult { allowed, guard, severity, message, details }`.
- `GuardResult` is `#[must_use]` -- callers cannot silently ignore verdicts.

**`AsyncGuard` trait** -- `crates/libs/clawdstrike/src/async_guards/types.rs:86-106`

```rust
#[async_trait]
pub trait AsyncGuard: Send + Sync {
    fn name(&self) -> &str;
    fn handles(&self, action: &GuardAction<'_>) -> bool;
    fn config(&self) -> &AsyncGuardConfig;
    fn cache_key(&self, action: &GuardAction<'_>, context: &GuardContext) -> Option<String>;
    async fn check_uncached(
        &self,
        action: &GuardAction<'_>,
        context: &GuardContext,
        http: &HttpClient,
    ) -> Result<GuardResult, AsyncGuardError>;
}
```

- Used for guards that call external services (VirusTotal, SafeBrowsing, Snyk, SpiderSense).
- Runtime wraps calls with timeout, rate limiting, circuit breaker, retry, and caching.
- `AsyncGuardConfig` holds all resilience settings (timeout, rate_limit, circuit_breaker, retry, cache_ttl).

### 1.2 Guard Action Types

**`GuardAction` enum** -- `crates/libs/clawdstrike/src/guards/mod.rs:279-295`

```rust
pub enum GuardAction<'a> {
    FileAccess(&'a str),
    FileWrite(&'a str, &'a [u8]),
    NetworkEgress(&'a str, u16),
    ShellCommand(&'a str),
    McpTool(&'a str, &'a serde_json::Value),
    Patch(&'a str, &'a str),
    Custom(&'a str, &'a serde_json::Value),  // <-- Plugin extension point
}
```

- `Custom(kind, payload)` is the generic escape hatch. Plugin guards can define their own action types.
- WASM guards see action types as strings: `"file_access"`, `"file_write"`, `"network_egress"`, `"shell_command"`, `"mcp_tool"`, `"patch"`, `"custom"`.

### 1.3 Evaluation Pipeline (4 Stages)

The engine evaluates guards in this order -- see `crates/libs/clawdstrike/src/engine.rs:623-730`:

```
Stage 0: Pre-guard checks (enclave MCP precheck, origin data precheck, origin budget precheck)
Stage 1: FastPath (cheap guards: forbidden_path, path_allowlist, egress_allowlist, mcp_tool)
Stage 2: StdPath (heavier guards: secret_leak, patch_integrity, shell_command, prompt_injection,
         jailbreak, computer_use, remote_desktop_side_channel, input_injection_capability
         + ALL custom_guards + ALL extra_guards)
Stage 3: DeepPath (async guards: VirusTotal, SafeBrowsing, Snyk, SpiderSense)
```

Key details:
- **FastPath vs StdPath routing**: `crates/libs/clawdstrike/src/pipeline.rs:75-82` -- `builtin_stage_for_guard_name()` routes by guard name.
- **fail_fast**: If enabled and a FastPath guard denies, StdPath is skipped entirely.
- **DeepPath only runs when all sync guards allowed** (line 704).
- **custom_guards + extra_guards are appended to StdPath** (lines 670-671).

### 1.4 Built-in Guards (12 sync + async)

**Sync built-ins** -- instantiated by `PolicyGuards` struct at `crates/libs/clawdstrike/src/policy.rs:2191-2204`:

| Guard | Stage | File |
|-------|-------|------|
| `ForbiddenPathGuard` | FastPath | `crates/libs/clawdstrike/src/guards/forbidden_path.rs` |
| `PathAllowlistGuard` | FastPath | `crates/libs/clawdstrike/src/guards/path_allowlist.rs` |
| `EgressAllowlistGuard` | FastPath | `crates/libs/clawdstrike/src/guards/egress_allowlist.rs` |
| `McpToolGuard` | FastPath | `crates/libs/clawdstrike/src/guards/mcp_tool.rs` |
| `SecretLeakGuard` | StdPath | `crates/libs/clawdstrike/src/guards/secret_leak.rs` |
| `PatchIntegrityGuard` | StdPath | `crates/libs/clawdstrike/src/guards/patch_integrity.rs` |
| `ShellCommandGuard` | StdPath | `crates/libs/clawdstrike/src/guards/shell_command.rs` |
| `PromptInjectionGuard` | StdPath | `crates/libs/clawdstrike/src/guards/prompt_injection.rs` |
| `JailbreakGuard` | StdPath | `crates/libs/clawdstrike/src/guards/jailbreak.rs` |
| `ComputerUseGuard` | StdPath | `crates/libs/clawdstrike/src/guards/computer_use.rs` |
| `RemoteDesktopSideChannelGuard` | StdPath | `crates/libs/clawdstrike/src/guards/remote_desktop_side_channel.rs` |
| `InputInjectionCapabilityGuard` | StdPath | `crates/libs/clawdstrike/src/guards/input_injection_capability.rs` |

**Async built-ins** -- registered via `crates/libs/clawdstrike/src/async_guards/registry.rs:22-66`:

| Guard | Package Name | File |
|-------|-------------|------|
| `SpiderSenseGuard` | first-class `guards.spider_sense` or `clawdstrike-spider-sense` | `crates/libs/clawdstrike/src/async_guards/threat_intel/spider_sense.rs` |
| `VirusTotalGuard` | `clawdstrike-virustotal` | `crates/libs/clawdstrike/src/async_guards/threat_intel/virustotal.rs` |
| `SafeBrowsingGuard` | `clawdstrike-safe-browsing` | `crates/libs/clawdstrike/src/async_guards/threat_intel/safe_browsing.rs` |
| `SnykGuard` | `clawdstrike-snyk` | `crates/libs/clawdstrike/src/async_guards/threat_intel/snyk.rs` |

### 1.5 Custom Guard Registry (Sync Plugin Seam)

**`CustomGuardFactory` trait** -- `crates/libs/clawdstrike/src/guards/custom.rs:14-17`

```rust
pub trait CustomGuardFactory: Send + Sync {
    fn id(&self) -> &str;
    fn build(&self, config: Value) -> Result<Box<dyn Guard>>;
}
```

**`CustomGuardRegistry`** -- `crates/libs/clawdstrike/src/guards/custom.rs:19-56`

```rust
pub struct CustomGuardRegistry {
    factories: HashMap<String, Arc<dyn CustomGuardFactory>>,
}

impl CustomGuardRegistry {
    pub fn register<F>(&mut self, factory: F) -> &mut Self
    where F: CustomGuardFactory + 'static;

    pub fn get(&self, id: &str) -> Option<&Arc<dyn CustomGuardFactory>>;
    pub fn build(&self, id: &str, config: Value) -> Result<Box<dyn Guard>>;
    pub fn register_from_package(&mut self, manifest: &PkgManifest, install_path: &Path) -> Result<()>;
}
```

- The registry is passed to `HushEngineBuilder` and used at `build()` time to instantiate policy-declared custom guards.
- `register_from_package()` loads WASM guard plugins from installed packages (requires `wasm-plugin-runtime` feature).

### 1.6 Policy-Declared Custom Guards

There are **two separate mechanisms** for custom guards in the policy YAML:

**Mechanism 1: `custom_guards[]` (top-level)** -- `crates/libs/clawdstrike/src/policy.rs:62-73`

```rust
pub struct PolicyCustomGuardSpec {
    pub id: String,           // Resolved via CustomGuardRegistry
    pub enabled: bool,
    pub config: serde_json::Value,
}
```

Policy YAML:
```yaml
custom_guards:
  - id: "acme.deny"
    enabled: true
    config:
      threshold: 0.8
```

- Built by `build_custom_guards_from_policy()` at engine creation (`crates/libs/clawdstrike/src/engine.rs:1659-1700`).
- Appended to `StdPath` evaluation.
- Requires a `CustomGuardRegistry` with matching factory.
- Placeholders (`${VAR}`) in config are resolved before passing to factory.

**Mechanism 2: `guards.custom[]` (nested in guards)** -- `crates/libs/clawdstrike/src/policy.rs:483-495`

```rust
pub struct CustomGuardSpec {
    pub package: String,       // Package name, e.g. "clawdstrike-virustotal"
    pub registry: Option<String>,
    pub version: Option<String>,
    pub enabled: bool,
    pub config: serde_json::Value,
    pub async_config: Option<AsyncGuardPolicyConfig>,
}
```

Policy YAML:
```yaml
guards:
  custom:
    - package: "clawdstrike-virustotal"
      enabled: true
      config:
        api_key: "${VIRUSTOTAL_API_KEY}"
```

- Built by `build_async_guards()` in `crates/libs/clawdstrike/src/async_guards/registry.rs:22-66`.
- **Currently only supports a hardcoded set** of package names (`clawdstrike-virustotal`, `clawdstrike-safe-browsing`, `clawdstrike-snyk`, `clawdstrike-spider-sense`).
- Unknown packages fail closed: `Err(Error::ConfigError("unsupported custom guard package: {other}"))`.
- This is the key seam that needs generalization for plugin async guards.

### 1.7 WASM Plugin Guard System

**Plugin Manifest** -- `crates/libs/clawdstrike/src/plugins/manifest.rs:10-22`

```rust
pub struct PluginManifest {
    pub plugin: PluginMetadata,
    pub clawdstrike: Option<PluginClawdstrikeCompatibility>,
    pub guards: Vec<PluginGuardManifestEntry>,
    pub capabilities: PluginCapabilities,
    pub resources: PluginResourceLimits,
    pub trust: PluginTrust,
}
```

File on disk: `clawdstrike.plugin.toml`

```toml
[plugin]
version = "1.0.0"
name = "acme-deny"

[[guards]]
name = "acme.deny"
entrypoint = "guard.wasm"
handles = ["file_access", "shell_command"]

[capabilities]
network = false
subprocess = false

[resources]
max_memory_mb = 64
max_cpu_ms = 100
max_timeout_ms = 5000

[trust]
level = "untrusted"
sandbox = "wasm"
```

**Guard entry** -- `crates/libs/clawdstrike/src/plugins/manifest.rs:141-151`

```rust
pub struct PluginGuardManifestEntry {
    pub name: String,
    pub display_name: Option<String>,
    pub entrypoint: Option<String>,  // defaults to "guard.wasm"
    pub handles: Vec<String>,        // empty = handles all action types
}
```

**WASM Guard ABI** -- `crates/libs/clawdstrike/src/plugins/runtime.rs`

Required WASM exports:
- `clawdstrike_guard_init() -> i32` -- Must return `1` (ABI version).
- `clawdstrike_guard_handles(action_ptr, action_len) -> i32` -- Return nonzero if guard handles this action type.
- `clawdstrike_guard_check(input_ptr, input_len) -> i32` -- Return 0 for success; output via `set_output` hostcall.
- `memory` -- Exported linear memory.

Host imports (`clawdstrike_host`):
- `set_output(ptr, len) -> i32` -- Write JSON output to host.
- `request_capability(kind) -> i32` -- Request host capability (0=network, 1=subprocess, 2=filesystem.read, 3=filesystem.write, 4=secrets.access).

Output JSON format:
```json
{ "allowed": false, "severity": "high", "message": "Denied by wasm", "details": {...} }
```

**Security model:**
- Capabilities are intersected between package manifest and plugin manifest (least privilege).
- Resource limits are clamped to the minimum of both manifests.
- WASM execution has fuel limits, epoch-based timeouts, and memory bounds.
- Untrusted plugins cannot request subprocess, filesystem write, or secrets access.
- Entrypoint paths are lexically normalized and checked for traversal.
- Fail-closed on all errors (corrupted WASM, ABI mismatch, timeout, capability denied).

**`WasmGuardFactory`** -- `crates/libs/clawdstrike/src/plugins/guard.rs:187-234`

```rust
impl CustomGuardFactory for WasmGuardFactory {
    fn id(&self) -> &str { &self.guard_id }
    fn build(&self, config: Value) -> Result<Box<dyn Guard>> { ... }
}
```

This is registered into the `CustomGuardRegistry` via `register_from_package()`.

**Plugin Loader** -- `crates/libs/clawdstrike/src/plugins/loader.rs`

```rust
pub struct PluginLoader { options: PluginLoaderOptions }

impl PluginLoader {
    pub fn inspect(&self, plugin_ref: &str) -> Result<PluginInspectResult>;
    pub fn plan(&self, plugin_ref: &str) -> Result<PluginLoadPlan>;
}
```

Options include `trusted_only`, `allow_wasm_sandbox`, `current_clawdstrike_version`, `max_resources`.

### 1.8 HushEngine Builder

**`HushEngineBuilder`** -- `crates/libs/clawdstrike/src/engine.rs:1537-1568`

```rust
pub struct HushEngineBuilder {
    policy: Policy,
    custom_guard_registry: Option<CustomGuardRegistry>,
    keypair: Option<Keypair>,
}
```

Usage:
```rust
let engine = HushEngine::builder(policy)
    .with_custom_guard_registry(registry)
    .with_generated_keypair()
    .build()?;

// Or add runtime guards after construction:
engine.add_guard(my_guard);       // impl Guard
engine.add_boxed_guard(boxed);    // Box<dyn Guard>
```

- `add_guard()` / `add_boxed_guard()` append to `extra_guards` (StdPath evaluation).

---

## 2. Guard Pipeline (TypeScript SDK)

### 2.1 Guard Interface

**`Guard` interface** -- `packages/sdk/hush-ts/src/guards/types.ts:278-293`

```typescript
export interface Guard {
  readonly name: string;
  handles(action: GuardAction): boolean;
  check(action: GuardAction, context: GuardContext): GuardResult | Promise<GuardResult>;
}
```

- Mirrors the Rust `Guard` trait exactly.
- `check()` can be sync or async (returns `GuardResult | Promise<GuardResult>`).
- The TS SDK's `Clawdstrike` class accepts a `guards: Guard[]` array in `ClawdstrikeConfig`.

### 2.2 GuardAction / GuardResult / GuardContext

**`GuardAction`** -- `packages/sdk/hush-ts/src/guards/types.ts:140-273`

```typescript
export class GuardAction {
  actionType: string;  // "file_access" | "file_write" | "network_egress" | "shell_command" | "mcp_tool" | "patch" | "custom"
  // ... per-type fields
  static fileAccess(path: string): GuardAction;
  static fileWrite(path: string, content: Uint8Array): GuardAction;
  static networkEgress(host: string, port: number): GuardAction;
  static shellCommand(command: string): GuardAction;
  static mcpTool(tool: string, args: Record<string, unknown>): GuardAction;
  static patch(path: string, diff: string): GuardAction;
  static custom(customType: string, data: Record<string, unknown>): GuardAction;
}
```

**`GuardResult`** -- `packages/sdk/hush-ts/src/guards/types.ts:57-94`

```typescript
export class GuardResult {
  readonly allowed: boolean;
  readonly guard: string;
  readonly severity: Severity;
  readonly message: string;
  details?: Record<string, unknown>;
  static allow(guard: string): GuardResult;
  static block(guard: string, severity: Severity, message: string): GuardResult;
  static warn(guard: string, message: string): GuardResult;
}
```

### 2.3 Built-in TS Guards

All in `packages/sdk/hush-ts/src/guards/`:

| Guard | File |
|-------|------|
| `ForbiddenPathGuard` | `forbidden-path.ts` |
| `EgressAllowlistGuard` | `egress-allowlist.ts` |
| `SecretLeakGuard` | `secret-leak.ts` |
| `PatchIntegrityGuard` | `patch-integrity.ts` |
| `McpToolGuard` | `mcp-tool.ts` |
| `PromptInjectionGuard` | `prompt-injection.ts` |
| `JailbreakGuard` | `jailbreak.ts` |
| `SpiderSenseGuard` | `spider-sense.ts` |

### 2.4 Plugin Extension Point (TS)

The TS SDK's `Clawdstrike` class accepts arbitrary `Guard` implementations:

```typescript
const cs = new Clawdstrike({
  guards: [
    new ForbiddenPathGuard(),
    new MyPluginGuard({ apiKey: "..." }),  // Custom guard implementing Guard interface
  ],
});
```

There is no `CustomGuardRegistry` equivalent in TS -- guards are passed directly. A plugin system would need to add a registry + WASM-backed guard wrapper similar to Rust's `WasmGuard`.

---

## 3. Detection Workflow Adapters

### 3.1 Adapter Interface

**`DetectionWorkflowAdapter`** -- `apps/workbench/src/lib/workbench/detection-workflow/adapters.ts:31-52`

```typescript
export interface DetectionWorkflowAdapter {
  fileType: FileType;
  canDraftFrom(seed: DraftSeed): boolean;
  buildDraft(seed: DraftSeed): DraftBuildResult;
  buildStarterEvidence(seed: DraftSeed, document: DetectionDocumentRef): EvidencePack;
  runLab(request: DetectionExecutionRequest): Promise<DetectionExecutionResult>;
  buildExplainability(run: LabRun): ExplainabilityTrace[];
  buildPublication(request: PublicationRequest): Promise<PublicationBuildResult>;
}
```

### 3.2 Adapter Registry

**`adapters.ts`** -- `apps/workbench/src/lib/workbench/detection-workflow/adapters.ts:54-72`

```typescript
const adapters = new Map<FileType, DetectionWorkflowAdapter>();

export function registerAdapter(adapter: DetectionWorkflowAdapter): void;
export function getAdapter(fileType: FileType): DetectionWorkflowAdapter | null;
export function hasAdapter(fileType: FileType): boolean;
export function getRegisteredFileTypes(): FileType[];
```

- Module-scoped `Map` keyed by `FileType`.
- Adapters self-register at import time via `registerAdapter()`.
- Each adapter handles exactly one `FileType`.

### 3.3 Current Adapters

| FileType | Adapter File | Registration |
|----------|-------------|-------------|
| `"clawdstrike_policy"` | `apps/workbench/src/lib/workbench/detection-workflow/policy-adapter.ts` | Auto-register at module load |
| `"sigma_rule"` | `apps/workbench/src/lib/workbench/detection-workflow/sigma-adapter.ts` | Auto-register at module load |
| `"yara_rule"` | `apps/workbench/src/lib/workbench/detection-workflow/yara-adapter.ts` | Auto-register at module load |
| `"ocsf_event"` | `apps/workbench/src/lib/workbench/detection-workflow/ocsf-adapter.ts` | Auto-register at module load |

### 3.4 FileType Union

**`FileType`** -- `apps/workbench/src/lib/workbench/file-type-registry.ts:6`

```typescript
export type FileType = "clawdstrike_policy" | "sigma_rule" | "yara_rule" | "ocsf_event";
```

**This is a discriminated union, not an open string.** Adding a new detection format (e.g., `"snort_rule"`, `"kql_query"`) requires:
1. Extending the `FileType` union.
2. Adding a `FileTypeDescriptor` entry in the registry with label, extensions, color, defaultContent.
3. Implementing a `DetectionWorkflowAdapter` and calling `registerAdapter()`.
4. Adding a corresponding `ExplainabilityTrace` variant to the discriminated union in `shared-types.ts:197-230`.

### 3.5 Shared Types (Detection Workflow)

All types are in `apps/workbench/src/lib/workbench/detection-workflow/shared-types.ts`.

**`DraftSeed`** -- input to draft generation:
```typescript
interface DraftSeed {
  id: string;
  kind: DraftSeedKind;  // "hunt_event" | "investigation" | "hunt_pattern" | "manual"
  sourceEventIds: string[];
  preferredFormats: FileType[];
  techniqueHints: string[];
  dataSourceHints: string[];
  extractedFields: Record<string, unknown>;
  confidence: number;
}
```

**`EvidenceItem`** -- discriminated union with 4 kinds:
- `"structured_event"` (JSON payload, expected match/no_match)
- `"bytes"` (hex/base64/utf8 payload, expected match/no_match)
- `"ocsf_event"` (OCSF payload, expected valid/invalid)
- `"policy_scenario"` (TestScenario, expected Verdict)

**`ExplainabilityTrace`** -- discriminated union with 4 kinds:
- `"sigma_match"` (matchedSelectors, matchedFields, techniqueHints, sourceLineHints)
- `"yara_match"` (matchedStrings, conditionSummary, sourceLineHints)
- `"ocsf_validation"` (classUid, missingFields, invalidFields)
- `"policy_evaluation"` (guardResults, evaluationPath)

### 3.6 Making Adapters Pluggable

The current architecture is close to pluggable but has two hardcoded bottlenecks:

**Bottleneck 1: `FileType` is a closed union.**
- Fix: Change to `string` with a `FileTypeRegistry` class that validates registered types. Or use a branded string type with runtime validation.

**Bottleneck 2: `ExplainabilityTrace` is a closed discriminated union.**
- Fix: Add a generic `"plugin_trace"` variant with `Record<string, unknown>` data, or make the union open with a `kind: string` discriminator.

**Bottleneck 3: Adapter imports are static.**
- Currently each adapter file calls `registerAdapter()` at module load time. For plugins, adapters need to be loaded dynamically (e.g., from a plugin manifest that specifies an adapter entrypoint).

---

## 4. Policy Schema

### 4.1 Version History

`crates/libs/clawdstrike/src/policy.rs:30-32`

```rust
pub const POLICY_SCHEMA_VERSION: &str = "1.5.0";
pub const POLICY_SUPPORTED_SCHEMA_VERSIONS: &[&str] = &["1.1.0", "1.2.0", "1.3.0", "1.4.0", "1.5.0"];
```

### 4.2 Policy Struct

`crates/libs/clawdstrike/src/policy.rs:178-203`

```rust
pub struct Policy {
    pub version: String,
    pub name: String,
    pub description: String,
    pub extends: Option<String>,
    pub merge_strategy: MergeStrategy,
    pub guards: GuardConfigs,
    pub custom_guards: Vec<PolicyCustomGuardSpec>,  // <-- top-level custom guards
    pub settings: PolicySettings,
    pub posture: Option<PostureConfig>,
    pub origins: Option<OriginsConfig>,
    pub broker: Option<BrokerConfig>,
}
```

### 4.3 GuardConfigs (Built-in Guard Configs)

`crates/libs/clawdstrike/src/policy.rs:251-300`

```rust
pub struct GuardConfigs {
    pub forbidden_path: Option<ForbiddenPathConfig>,
    pub path_allowlist: Option<PathAllowlistConfig>,
    pub egress_allowlist: Option<EgressAllowlistConfig>,
    pub secret_leak: Option<SecretLeakConfig>,
    pub patch_integrity: Option<PatchIntegrityConfig>,
    pub shell_command: Option<ShellCommandConfig>,
    pub mcp_tool: Option<McpToolConfig>,
    pub prompt_injection: Option<PromptInjectionConfig>,
    pub jailbreak: Option<JailbreakConfig>,
    pub computer_use: Option<ComputerUseConfig>,
    pub remote_desktop_side_channel: Option<RemoteDesktopSideChannelConfig>,
    pub input_injection_capability: Option<InputInjectionCapabilityConfig>,
    pub spider_sense: Option<SpiderSensePolicyConfig>,  // #[cfg(feature = "full")]
    pub custom: Vec<CustomGuardSpec>,  // async custom guards
}
```

- Uses `#[serde(deny_unknown_fields)]` -- adding a new built-in guard field is a breaking schema change.
- `custom: Vec<CustomGuardSpec>` is the extension point for async guards (package-based).

### 4.4 Extension Points for Plugin Guard Schemas

Currently, plugin guards store their configuration as opaque `serde_json::Value`:

- `PolicyCustomGuardSpec.config: serde_json::Value` (top-level custom_guards)
- `CustomGuardSpec.config: serde_json::Value` (guards.custom)

This means the policy schema validator cannot validate plugin guard configs at load time -- only the guard factory can validate when `build()` is called. For a plugin ecosystem, this needs a JSON Schema mechanism where plugins declare their config schema in `clawdstrike.plugin.toml`, and the policy loader validates configs against it.

### 4.5 Policy Merge Semantics

- `MergeStrategy::DeepMerge` is the default.
- `GuardConfigs::merge_with()` has per-guard merge logic (some guards deep-merge, some replace).
- `custom_guards` are merged by id (child overrides base for matching ids).
- `guards.custom` are merged with `merge_custom_guards()` which deduplicates by package name.

---

## 5. Guard Config UI

### 5.1 Guard Registry (Workbench)

`apps/workbench/src/lib/workbench/guard-registry.ts`

```typescript
export const GUARD_REGISTRY: GuardMeta[] = [
  {
    id: "forbidden_path",
    name: "Forbidden Path",
    technicalName: "ForbiddenPathGuard",
    description: "...",
    category: "filesystem",
    defaultVerdict: "deny",
    icon: "IconLock",
    configFields: [
      { key: "enabled", label: "Enabled", type: "toggle", defaultValue: true },
      { key: "patterns", label: "Forbidden Patterns", type: "pattern_list", ... },
      { key: "exceptions", label: "Exceptions", type: "string_list", ... },
    ],
  },
  // ... 12 more built-in guards
];
```

### 5.2 GuardId Type

`apps/workbench/src/lib/workbench/types.ts:10-23`

```typescript
export type GuardId =
  | "forbidden_path"
  | "path_allowlist"
  | "egress_allowlist"
  | "secret_leak"
  | "patch_integrity"
  | "shell_command"
  | "mcp_tool"
  | "prompt_injection"
  | "jailbreak"
  | "computer_use"
  | "remote_desktop_side_channel"
  | "input_injection_capability"
  | "spider_sense";
```

**This is a closed union** -- same pattern as `FileType`. Plugin guards cannot be represented without extending it.

### 5.3 ConfigFieldDef (Schema-Driven Forms)

`apps/workbench/src/lib/workbench/types.ts:513-532`

```typescript
export type ConfigFieldType =
  | "toggle"
  | "string_list"
  | "pattern_list"
  | "number_slider"
  | "number_input"
  | "select"
  | "secret_pattern_list";

export interface ConfigFieldDef {
  key: string;
  label: string;
  type: ConfigFieldType;
  description?: string;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}
```

### 5.4 GuardConfigFields Component

`apps/workbench/src/components/workbench/editor/guard-config-fields.tsx`

- Looks up `GuardMeta` from `GUARD_REGISTRY` by `guardId`.
- Iterates `meta.configFields` and renders a `FieldRenderer` for each.
- `FieldRenderer` handles: `toggle`, `string_list`, `pattern_list`, `number_slider`, `number_input`, `select`, `secret_pattern_list`.
- The component is already schema-driven -- it renders from `ConfigFieldDef[]`.

### 5.5 Making Forms Work for Plugin Guards

The form system is already schema-driven. To support plugin guards:

1. **Open `GuardId`**: Change from union to `string` (or `GuardId | string`).
2. **Dynamic `GUARD_REGISTRY`**: Change from a static `const` array to a mutable registry (similar to the adapter registry pattern).
3. **Plugin-supplied `GuardMeta`**: Plugin manifests declare `configFields` in their manifest, which get registered as `GuardMeta` entries at load time.
4. **Additional `ConfigFieldType` values**: May need `"json"`, `"code_editor"`, `"file_path"` for more complex plugin configs. The `FieldRenderer` switch should have a `default` case that renders a JSON editor fallback.

---

## 6. Summary of Seams for Plugin Integration

### Rust Seams (Guard Execution)

| Seam | Location | Status | Plugin Path |
|------|----------|--------|-------------|
| `Guard` trait | `guards/mod.rs:298` | Stable | Implement directly or via WASM |
| `AsyncGuard` trait | `async_guards/types.rs:86` | Stable | Implement for external-service guards |
| `CustomGuardFactory` trait | `guards/custom.rs:14` | Stable | Register factory in `CustomGuardRegistry` |
| `CustomGuardRegistry` | `guards/custom.rs:19` | Stable | Pass to `HushEngineBuilder` |
| `register_from_package()` | `guards/custom.rs:66` | Stable | Load WASM guards from pkg manifest |
| `WasmGuardFactory` | `plugins/guard.rs:187` | Stable | Auto-created by `register_from_package` |
| WASM ABI | `plugins/runtime.rs` | Stable (v1) | Implement 4 exports + 2 imports |
| `guards.custom[]` async registry | `async_guards/registry.rs:68-98` | **Hardcoded** | Needs generalization for plugin packages |
| `GuardAction::Custom` | `guards/mod.rs:294` | Stable | Use for custom action types |
| `extra_guards` (runtime) | `engine.rs:245-275` | Stable | `engine.add_guard()` at runtime |

### TypeScript Seams (SDK)

| Seam | Location | Status | Plugin Path |
|------|----------|--------|-------------|
| `Guard` interface | `guards/types.ts:278` | Stable | Implement interface |
| `ClawdstrikeConfig.guards` | `clawdstrike.ts:130` | Stable | Pass custom guards |
| No `CustomGuardRegistry` | -- | **Missing** | Need to build for TS |

### Workbench Seams (UI)

| Seam | Location | Status | Plugin Path |
|------|----------|--------|-------------|
| `DetectionWorkflowAdapter` | `detection-workflow/adapters.ts:31` | Stable interface | Implement + `registerAdapter()` |
| Adapter `Map` registry | `detection-workflow/adapters.ts:56` | Stable | Call `registerAdapter()` |
| `FileType` union | `file-type-registry.ts:6` | **Closed** | Must open to string or extend |
| `ExplainabilityTrace` union | `shared-types.ts:197` | **Closed** | Must add generic variant |
| `GUARD_REGISTRY` | `guard-registry.ts:3` | **Static array** | Must make dynamic |
| `GuardId` union | `types.ts:10` | **Closed** | Must open to string |
| `ConfigFieldDef` schema | `types.ts:522` | Stable | Plugin manifests supply these |
| `GuardConfigFields` component | `guard-config-fields.tsx` | **Schema-driven** | Already works with dynamic defs |
| `ConfigFieldType` union | `types.ts:513` | **Closed** | May need `"json"` fallback type |
