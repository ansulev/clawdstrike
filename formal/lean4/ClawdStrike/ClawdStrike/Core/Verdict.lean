/-
  ClawdStrike Core: Verdict Types and Guard Configurations

  This module defines the complete type system for the policy engine specification:
  - Severity levels with total ordering
  - Guard results (verdicts)
  - Action types (the action domain)
  - Guard configuration structures (mirroring Rust structs)
  - Policy structure

  Rust source references:
    - `CoreSeverity` enum: crates/libs/clawdstrike/src/core/verdict.rs:8-17
    - `severity_ord` fn: crates/libs/clawdstrike/src/core/verdict.rs:25-32
    - `CoreVerdict` struct: crates/libs/clawdstrike/src/core/verdict.rs:38-50
    - `GuardAction<'a>` enum: crates/libs/clawdstrike/src/guards/mod.rs
    - `ForbiddenPathConfig`: crates/libs/clawdstrike/src/guards/forbidden_path.rs:16-32
    - `PathAllowlistConfig`: crates/libs/clawdstrike/src/guards/path_allowlist.rs:16-29
    - `EgressAllowlistConfig`: crates/libs/clawdstrike/src/guards/egress_allowlist.rs:13-38
    - `ShellCommandConfig`: crates/libs/clawdstrike/src/guards/shell_command.rs:15-25
    - `McpToolConfig`: crates/libs/clawdstrike/src/guards/mcp_tool.rs:22-54
    - `GuardConfigs`: crates/libs/clawdstrike/src/policy.rs:231-278
    - `MergeStrategy` enum: crates/libs/clawdstrike/src/core/merge.rs:13-21
    - `Policy` struct: crates/libs/clawdstrike/src/policy.rs:180-205
    - `PolicySettings` struct: crates/libs/clawdstrike/src/policy.rs:475-484
-/

set_option autoImplicit false

namespace ClawdStrike.Core

-- ============================================================================
-- Type Abbreviations
-- ============================================================================

/-- A filesystem path (opaque string). -/
abbrev Path := String

/-- A network domain (opaque string). -/
abbrev Domain := String

/-- A shell command (opaque string). -/
abbrev Command := String

/-- A tool name for MCP invocations. -/
abbrev ToolName := String

/-- Opaque JSON arguments. -/
abbrev Args := String

/-- A unified diff. -/
abbrev Diff := String

/-- A custom action type identifier. -/
abbrev ActionType := String

/-- A glob pattern string (matching is axiomatized). -/
abbrev GlobPattern := String

-- ============================================================================
-- Severity
-- ============================================================================

/-- Severity levels for guard violations, ordered Info < Warning < Error < Critical.
    Mirrors Rust `CoreSeverity` enum in core/verdict.rs:8-17. -/
inductive Severity where
  | info
  | warning
  | error
  | critical
  deriving Repr, BEq, DecidableEq, Inhabited

/-- Map severity to a natural number for ordering.
    Mirrors Rust `severity_ord` in core/verdict.rs:25-32.
    Info(0) < Warning(1) < Error(2) < Critical(3). -/
def Severity.toNat : Severity → Nat
  | .info => 0
  | .warning => 1
  | .error => 2
  | .critical => 3

/-- Total order on Severity via toNat. -/
instance : LE Severity where
  le a b := a.toNat ≤ b.toNat

instance : LT Severity where
  lt a b := a.toNat < b.toNat

instance (a b : Severity) : Decidable (a ≤ b) :=
  inferInstanceAs (Decidable (a.toNat ≤ b.toNat))

instance (a b : Severity) : Decidable (a < b) :=
  inferInstanceAs (Decidable (a.toNat < b.toNat))

/-- toNat is injective: equal ordinals imply equal severities. -/
theorem Severity.toNat_injective (a b : Severity) (h : a.toNat = b.toNat) : a = b := by
  cases a <;> cases b <;> simp [Severity.toNat] at h <;> rfl

-- ============================================================================
-- GuardResult (Verdict)
-- ============================================================================

/-- Result of a single guard evaluation.
    Mirrors Rust `CoreVerdict` struct in core/verdict.rs:38-50.

    Fields:
    - `allowed`: whether the action is permitted
    - `severity`: severity of any violation
    - `guardName`: name of the guard that produced this result
    - `message`: human-readable message
    - `sanitized`: whether content was modified (sanitization tiebreaker) -/
structure GuardResult where
  allowed : Bool
  severity : Severity
  guardName : String
  message : String
  sanitized : Bool := false
  deriving Repr, BEq

/-- Convenience: create an allow verdict.
    Mirrors Rust `CoreVerdict::allow()`. -/
def GuardResult.allow (guard : String) : GuardResult :=
  { allowed := true
  , severity := .info
  , guardName := guard
  , message := "Allowed"
  , sanitized := false }

/-- Convenience: create a block verdict.
    Mirrors Rust `CoreVerdict::block()`. -/
def GuardResult.block (guard : String) (sev : Severity) (msg : String) : GuardResult :=
  { allowed := false
  , severity := sev
  , guardName := guard
  , message := msg
  , sanitized := false }

/-- Convenience: create a warning verdict (allowed but logged).
    Mirrors Rust `CoreVerdict::warn()`. -/
def GuardResult.warn (guard : String) (msg : String) : GuardResult :=
  { allowed := true
  , severity := .warning
  , guardName := guard
  , message := msg
  , sanitized := false }

/-- Convenience: create a sanitize verdict (allowed, content modified).
    Mirrors Rust `CoreVerdict::sanitize()`. -/
def GuardResult.sanitize (guard : String) (msg : String) : GuardResult :=
  { allowed := true
  , severity := .warning
  , guardName := guard
  , message := msg
  , sanitized := true }

-- ============================================================================
-- Action Types
-- ============================================================================

/-- The action domain. Every guard check evaluates one action.
    Mirrors `GuardAction<'a>` in `guards/mod.rs`.

    Note: `fileWrite` carries a `List UInt8` for content (opaque bytes).
    `networkEgress` carries the port number.
    `custom` is for extension/plugin actions. -/
inductive Action where
  | fileAccess   : Path → Action
  | fileWrite    : Path → List UInt8 → Action
  | networkEgress : Domain → UInt16 → Action
  | shellCommand : Command → Action
  | mcpTool      : ToolName → Args → Action
  | patch        : Path → Diff → Action
  | custom       : ActionType → Args → Action
  deriving Repr, BEq

-- ============================================================================
-- Guard Configuration Types
-- ============================================================================

/-- Configuration for ForbiddenPathGuard.
    Mirrors Rust `ForbiddenPathConfig` in guards/forbidden_path.rs:16-32.

    Note: `patterns = none` means "use default forbidden patterns" (SSH keys,
    AWS credentials, env files, etc.). This is computed by
    `default_forbidden_patterns()` in the Rust code. -/
structure ForbiddenPathConfig where
  enabled : Bool := true
  /-- Explicit patterns. `none` means use defaults. -/
  patterns : Option (List GlobPattern) := none
  /-- Exception paths that are allowed even if they match a forbidden pattern. -/
  exceptions : List GlobPattern := []
  /-- Additional patterns to add when merging (for extends). -/
  additionalPatterns : List GlobPattern := []
  /-- Patterns to remove when merging (for extends). -/
  removePatterns : List GlobPattern := []
  deriving Repr, BEq

/-- Configuration for PathAllowlistGuard.
    Mirrors Rust `PathAllowlistConfig` in guards/path_allowlist.rs:16-29.

    Note: the Rust struct has separate `file_access_allow`, `file_write_allow`,
    and `patch_allow` fields. For the formal spec we simplify to three lists
    to match the Rust structure. -/
structure PathAllowlistConfig where
  enabled : Bool := true
  fileAccessAllow : List GlobPattern := []
  fileWriteAllow : List GlobPattern := []
  patchAllow : List GlobPattern := []
  deriving Repr, BEq

/-- Default action for egress policy (axiomatized subset).
    Mirrors `PolicyAction` in the Rust proxy crate. -/
inductive PolicyAction where
  | allow
  | block
  | log
  deriving Repr, BEq, DecidableEq

/-- Configuration for EgressAllowlistGuard.
    Mirrors Rust `EgressAllowlistConfig` in guards/egress_allowlist.rs:13-38. -/
structure EgressAllowlistConfig where
  enabled : Bool := true
  /-- Allowed domain patterns. -/
  allow : List Domain := []
  /-- Blocked domain patterns (takes precedence over allow). -/
  block : List Domain := []
  /-- Default action when no pattern matches. -/
  defaultAction : Option PolicyAction := none
  /-- Additional allowed domains when merging. -/
  additionalAllow : List Domain := []
  /-- Domains to remove from allow list when merging. -/
  removeAllow : List Domain := []
  /-- Additional blocked domains when merging. -/
  additionalBlock : List Domain := []
  /-- Domains to remove from block list when merging. -/
  removeBlock : List Domain := []
  deriving Repr, BEq

/-- Configuration for ShellCommandGuard.
    Mirrors Rust `ShellCommandConfig` in guards/shell_command.rs:15-25.

    Note: `forbiddenPatterns` are regex patterns (matching is axiomatized). -/
structure ShellCommandConfig where
  enabled : Bool := true
  /-- Regex patterns that are forbidden in shell commands. -/
  forbiddenPatterns : List String := []
  /-- Whether to run forbidden-path checks on extracted path tokens. -/
  enforceForbiddenPaths : Bool := true
  deriving Repr, BEq

/-- Default behavior when a MCP tool is not explicitly allowed/blocked.
    Mirrors Rust `McpDefaultAction` in guards/mcp_tool.rs:12-18. -/
inductive McpDefaultAction where
  | allow
  | block
  deriving Repr, BEq, DecidableEq

/-- Configuration for McpToolGuard.
    Mirrors Rust `McpToolConfig` in guards/mcp_tool.rs:22-54. -/
structure McpToolConfig where
  enabled : Bool := true
  /-- Allowed tool names (if empty, all are allowed except blocked). -/
  allow : List ToolName := []
  /-- Blocked tool names (takes precedence over allow). -/
  block : List ToolName := []
  /-- Tools that require confirmation. -/
  requireConfirmation : List ToolName := []
  /-- Default action when not explicitly matched. -/
  defaultAction : Option McpDefaultAction := none
  /-- Maximum arguments size (bytes). -/
  maxArgsSize : Option Nat := none
  /-- Additional allowed tools when merging. -/
  additionalAllow : List ToolName := []
  /-- Tools to remove from allow list when merging. -/
  removeAllow : List ToolName := []
  /-- Additional blocked tools when merging. -/
  additionalBlock : List ToolName := []
  /-- Tools to remove from block list when merging. -/
  removeBlock : List ToolName := []
  deriving Repr, BEq

/-- Secret pattern entry for SecretLeakGuard. -/
structure SecretPattern where
  name : String
  pattern : String
  deriving Repr, BEq

/-- Configuration for SecretLeakGuard (simplified for spec). -/
structure SecretLeakConfig where
  enabled : Bool := true
  patterns : List SecretPattern := []
  additionalPatterns : List SecretPattern := []
  removePatterns : List String := []
  skipPaths : List GlobPattern := []
  deriving Repr, BEq

/-- Configuration for PatchIntegrityGuard (simplified for spec). -/
structure PatchIntegrityConfig where
  maxAdditions : Nat := 500
  maxDeletions : Nat := 500
  requireBalance : Bool := false
  forbiddenPatterns : List String := []
  deriving Repr, BEq

/-- Content-dependent guard configuration (opaque for spec).
    Used for guards whose verdicts depend on runtime content analysis
    (prompt injection, jailbreak, computer use, etc.).
    We only model the `enabled` flag. -/
structure ContentGuardConfig where
  enabled : Bool := true
  deriving Repr, BEq

-- ============================================================================
-- GuardConfigs
-- ============================================================================

/-- Union of all guard configurations.
    Mirrors `GuardConfigs` in `policy.rs:231-278`.

    Guards are `Option` because they can be omitted from a policy.
    `none` means the guard is not configured (will not run).

    Guard categories by merge behavior:
    - Deep-merge: forbiddenPath, egressAllowlist, mcpTool, secretLeak
    - Merge-with: pathAllowlist
    - Child-overrides: patchIntegrity, shellCommand, promptInjection,
      jailbreak, computerUse, remoteDesktopSideChannel,
      inputInjectionCapability, spiderSense -/
structure GuardConfigs where
  forbiddenPath : Option ForbiddenPathConfig := none
  pathAllowlist : Option PathAllowlistConfig := none
  egressAllowlist : Option EgressAllowlistConfig := none
  secretLeak : Option SecretLeakConfig := none
  patchIntegrity : Option PatchIntegrityConfig := none
  shellCommand : Option ShellCommandConfig := none
  mcpTool : Option McpToolConfig := none
  promptInjection : Option ContentGuardConfig := none
  jailbreak : Option ContentGuardConfig := none
  computerUse : Option ContentGuardConfig := none
  remoteDesktopSideChannel : Option ContentGuardConfig := none
  inputInjectionCapability : Option ContentGuardConfig := none
  spiderSense : Option ContentGuardConfig := none
  deriving Repr, BEq

instance : Inhabited GuardConfigs where
  default := {}

-- ============================================================================
-- Merge Strategy
-- ============================================================================

/-- Merge strategies for policy combination.
    Mirrors Rust `CoreMergeStrategy` in core/merge.rs:13-21
    and `MergeStrategy` in policy.rs:168-178. -/
inductive MergeStrategy where
  /-- Child completely replaces base. -/
  | replace
  /-- Shallow merge: child fields override base at top level. -/
  | merge
  /-- Deep merge: recursively merge nested structures (default). -/
  | deepMerge
  deriving Repr, BEq, DecidableEq

-- ============================================================================
-- Policy Settings
-- ============================================================================

/-- Policy settings controlling engine behavior.
    Mirrors Rust `PolicySettings` in policy.rs:475-484. -/
structure PolicySettings where
  failFast : Option Bool := none
  verboseLogging : Option Bool := none
  sessionTimeoutSecs : Option Nat := none
  deriving Repr, BEq

/-- Effective fail-fast value (defaults to false). -/
def PolicySettings.effectiveFailFast (s : PolicySettings) : Bool :=
  s.failFast.getD false

/-- Effective verbose logging value (defaults to false). -/
def PolicySettings.effectiveVerboseLogging (s : PolicySettings) : Bool :=
  s.verboseLogging.getD false

/-- Effective session timeout (defaults to 3600). -/
def PolicySettings.effectiveSessionTimeoutSecs (s : PolicySettings) : Nat :=
  s.sessionTimeoutSecs.getD 3600

instance : Inhabited PolicySettings where
  default := {}

-- ============================================================================
-- Version
-- ============================================================================

/-- Semantic version (major, minor, patch). -/
structure Version where
  major : Nat
  minor : Nat
  patch : Nat
  deriving Repr, BEq, DecidableEq

/-- Supported schema versions.
    Mirrors `POLICY_SUPPORTED_SCHEMA_VERSIONS` in policy.rs:30-31. -/
def supportedVersions : List Version :=
  [⟨1,1,0⟩, ⟨1,2,0⟩, ⟨1,3,0⟩, ⟨1,4,0⟩, ⟨1,5,0⟩]

/-- Current schema version.
    Mirrors `POLICY_SCHEMA_VERSION` in policy.rs:29. -/
def currentSchemaVersion : Version := ⟨1,5,0⟩

-- ============================================================================
-- Policy Reference (extends targets)
-- ============================================================================

/-- Reference to a policy for `extends` chains.
    Mirrors the various `PolicyLocation` variants in policy.rs:82-99. -/
inductive PolicyRef where
  | ruleset : String → PolicyRef
  | file    : Path → PolicyRef
  | url     : String → PolicyRef
  deriving Repr, BEq

-- ============================================================================
-- Policy
-- ============================================================================

/-- A fully resolved policy (after extends chain resolution).
    Mirrors Rust `Policy` struct in policy.rs:180-205.

    Note: we model `extends` as `Option PolicyRef` but after full resolution
    it will be `none` (the chain is flattened). -/
structure Policy where
  version : Version := currentSchemaVersion
  name : String := ""
  description : String := ""
  extends_ : Option PolicyRef := none
  mergeStrategy : MergeStrategy := .deepMerge
  guards : GuardConfigs := {}
  settings : PolicySettings := {}
  deriving Repr, BEq

instance : Inhabited Policy where
  default := {}

-- ============================================================================
-- Evaluation Context
-- ============================================================================

/-- Evaluation context passed to guard checks.
    Mirrors `GuardContext` in guards/mod.rs. -/
structure Context where
  cwd : Option Path := none
  sessionId : Option String := none
  agentId : Option String := none
  metadata : Option String := none
  deriving Repr, BEq

instance : Inhabited Context where
  default := {}

end ClawdStrike.Core
