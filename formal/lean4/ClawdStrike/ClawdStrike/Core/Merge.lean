/-
  ClawdStrike Core: Policy Merge

  The policy merge system supports three strategies: Replace, Merge, and DeepMerge.
  This module models the merge semantics for formal verification.

  Key properties:
  - P5 (Inheritance Restrictiveness): merging a child policy can only preserve
    or add denials, never remove them.
  - P6 (Merge Idempotence): merging a policy with itself produces equivalent
    evaluation results.

  Guard merge categories (from policy.rs:280-368):
  - Deep-merge (additive/subtractive): forbidden_path, egress_allowlist, mcp_tool, secret_leak
  - Merge-with: path_allowlist
  - Child-overrides: patch_integrity, shell_command, prompt_injection, jailbreak,
    computer_use, remote_desktop_side_channel, input_injection_capability, spider_sense

  Rust source references:
    - `CoreMergeStrategy`: crates/libs/clawdstrike/src/core/merge.rs:13-21
    - `child_overrides`: crates/libs/clawdstrike/src/core/merge.rs:33-35
    - `GuardConfigs::merge_with`: crates/libs/clawdstrike/src/policy.rs:281-369
    - `ForbiddenPathConfig::merge_with`: crates/libs/clawdstrike/src/guards/forbidden_path.rs:139-180
    - `EgressAllowlistConfig::merge_with`: crates/libs/clawdstrike/src/guards/egress_allowlist.rs:78-119
    - `McpToolConfig::merge_with`: crates/libs/clawdstrike/src/guards/mcp_tool.rs:120-150
    - `PathAllowlistConfig::merge_with`: crates/libs/clawdstrike/src/guards/path_allowlist.rs:36-56
-/

import ClawdStrike.Core.Verdict

set_option autoImplicit false

namespace ClawdStrike.Core

-- ============================================================================
-- Generic Merge Combinators
-- ============================================================================

/-- "Child overrides base" -- if child has a value, use it; otherwise fall back to base.
    Mirrors Rust `child_overrides` in core/merge.rs:33-35.
    Used for simple-override guards (patch_integrity, shell_command, etc.). -/
def childOverrides {α : Type} (base child : Option α) : Option α :=
  match child with
  | some c => some c
  | none => base

/-- "Child overrides base" for non-empty strings.
    Mirrors Rust `child_overrides_str` in core/merge.rs:42-48. -/
def childOverridesStr (base child : String) : String :=
  if child.isEmpty then base else child

-- ============================================================================
-- Axiomatized Default Patterns
-- ============================================================================

/-- Default forbidden patterns (SSH keys, AWS credentials, env files, etc.)
    Axiomatized as an opaque constant since the exact list is large (~30 entries).
    See `default_forbidden_patterns()` in forbidden_path.rs:44-104. -/
axiom defaultForbiddenPatterns : List GlobPattern

-- ============================================================================
-- ForbiddenPathConfig Merge
-- ============================================================================

/-- Compute the effective patterns for a ForbiddenPathConfig.
    Mirrors `ForbiddenPathConfig::effective_patterns()` in forbidden_path.rs:118-132.

    Algorithm:
    1. Start with explicit patterns, or defaults if patterns is none
    2. Append additional_patterns (deduplicating)
    3. Remove remove_patterns -/
noncomputable def ForbiddenPathConfig.effectivePatterns (cfg : ForbiddenPathConfig) : List GlobPattern :=
  let base := match cfg.patterns with
    | some ps => ps
    | none => defaultForbiddenPatterns
  let withAdditions := base ++ cfg.additionalPatterns.filter (fun p => !base.contains p)
  withAdditions.filter (fun p => !cfg.removePatterns.contains p)

/-- Merge two ForbiddenPathConfigs (deep merge).
    Mirrors `ForbiddenPathConfig::merge_with()` in forbidden_path.rs:139-180.

    Key semantics:
    - If child has explicit `patterns`, those replace the base.
    - Otherwise, start with base's effective_patterns.
    - Add child's additional_patterns (deduplicating).
    - Remove child's remove_patterns.
    - Exceptions are unioned (base ++ child, deduplicating). -/
noncomputable def ForbiddenPathConfig.mergeWith (base child : ForbiddenPathConfig) : ForbiddenPathConfig :=
  let startPatterns := match child.patterns with
    | some ps => ps
    | none => base.effectivePatterns
  let withAdditions := startPatterns ++ child.additionalPatterns.filter
    (fun p => !startPatterns.contains p)
  let finalPatterns := withAdditions.filter (fun p => !child.removePatterns.contains p)
  let mergedExceptions := base.exceptions ++ child.exceptions.filter
    (fun e => !base.exceptions.contains e)
  { enabled := child.enabled
  , patterns := some finalPatterns
  , exceptions := mergedExceptions
  , additionalPatterns := []
  , removePatterns := [] }

-- ============================================================================
-- PathAllowlistConfig Merge
-- ============================================================================

/-- Merge two PathAllowlistConfigs.
    Mirrors `PathAllowlistConfig::merge_with()` in path_allowlist.rs:36-56.

    Child lists replace base lists when non-empty. -/
def PathAllowlistConfig.mergeWith (base child : PathAllowlistConfig) : PathAllowlistConfig :=
  { enabled := child.enabled
  , fileAccessAllow := if child.fileAccessAllow.isEmpty then base.fileAccessAllow
                       else child.fileAccessAllow
  , fileWriteAllow := if child.fileWriteAllow.isEmpty then base.fileWriteAllow
                      else child.fileWriteAllow
  , patchAllow := if child.patchAllow.isEmpty then base.patchAllow
                  else child.patchAllow }

-- ============================================================================
-- EgressAllowlistConfig Merge
-- ============================================================================

/-- Default egress allowlist config, used when base is None but child exists.
    Mirrors `EgressAllowlistConfig::with_defaults()` in egress_allowlist.rs:52-75. -/
def EgressAllowlistConfig.defaults : EgressAllowlistConfig :=
  { enabled := true
  , allow := ["*.openai.com", "*.anthropic.com", "api.github.com",
              "*.npmjs.org", "registry.npmjs.org", "pypi.org",
              "files.pythonhosted.org", "crates.io", "static.crates.io"]
  , block := []
  , defaultAction := some .block
  , additionalAllow := []
  , removeAllow := []
  , additionalBlock := []
  , removeBlock := [] }

/-- Merge two EgressAllowlistConfigs.
    Mirrors `EgressAllowlistConfig::merge_with()` in egress_allowlist.rs:78-119.

    Key semantics:
    - Start with base allow/block lists.
    - Add child's additional_allow/additional_block (deduplicating).
    - Remove child's remove_allow/remove_block.
    - If child has non-empty allow/block lists, REPLACE (not union) base lists.
    - Default action: child's if present, else base's. -/
def EgressAllowlistConfig.mergeWith (base child : EgressAllowlistConfig) : EgressAllowlistConfig :=
  let mutAllow := (base.allow ++ child.additionalAllow.filter (fun d => !base.allow.contains d))
    |>.filter (fun d => !child.removeAllow.contains d)
  let mutBlock := (base.block ++ child.additionalBlock.filter (fun d => !base.block.contains d))
    |>.filter (fun d => !child.removeBlock.contains d)
  -- Non-empty child lists REPLACE (happens after add/remove in Rust)
  let finalAllow := if child.allow.isEmpty then mutAllow else child.allow
  let finalBlock := if child.block.isEmpty then mutBlock else child.block
  { enabled := child.enabled
  , allow := finalAllow
  , block := finalBlock
  , defaultAction := match child.defaultAction with
      | some a => some a
      | none => base.defaultAction
  , additionalAllow := []
  , removeAllow := []
  , additionalBlock := []
  , removeBlock := [] }

-- ============================================================================
-- McpToolConfig Merge
-- ============================================================================

/-- Default MCP tool config, used when base is None but child exists.
    Mirrors `McpToolConfig::with_defaults()` in mcp_tool.rs:92-117. -/
def McpToolConfig.defaults : McpToolConfig :=
  { enabled := true
  , allow := []
  , block := ["shell_exec", "run_command", "raw_file_write", "raw_file_delete"]
  , requireConfirmation := ["file_write", "file_delete", "git_push"]
  , defaultAction := some .allow
  , maxArgsSize := some 1048576
  , additionalAllow := []
  , removeAllow := []
  , additionalBlock := []
  , removeBlock := [] }

/-- Merge two McpToolConfigs.
    Mirrors `McpToolConfig::merge_with()` in mcp_tool.rs:120-150.

    Same additive/subtractive + replace semantics as EgressAllowlistConfig. -/
def McpToolConfig.mergeWith (base child : McpToolConfig) : McpToolConfig :=
  let mutAllow := (base.allow ++ child.additionalAllow.filter (fun t => !base.allow.contains t))
    |>.filter (fun t => !child.removeAllow.contains t)
  let mutBlock := (base.block ++ child.additionalBlock.filter (fun t => !base.block.contains t))
    |>.filter (fun t => !child.removeBlock.contains t)
  let finalAllow := if child.allow.isEmpty then mutAllow else child.allow
  let finalBlock := if child.block.isEmpty then mutBlock else child.block
  let finalConfirm := if child.requireConfirmation.isEmpty then base.requireConfirmation
                      else child.requireConfirmation
  { enabled := child.enabled
  , allow := finalAllow
  , block := finalBlock
  , requireConfirmation := finalConfirm
  , defaultAction := match child.defaultAction with
      | some a => some a
      | none => base.defaultAction
  , maxArgsSize := match child.maxArgsSize with
      | some s => some s
      | none => base.maxArgsSize
  , additionalAllow := []
  , removeAllow := []
  , additionalBlock := []
  , removeBlock := [] }

-- ============================================================================
-- SecretLeakConfig Merge (simplified)
-- ============================================================================

/-- Merge two SecretLeakConfigs (simplified deep merge). -/
def SecretLeakConfig.mergeWith (base child : SecretLeakConfig) : SecretLeakConfig :=
  { enabled := child.enabled
  , patterns := if child.patterns.isEmpty then base.patterns else child.patterns
  , additionalPatterns := []
  , removePatterns := []
  , skipPaths := if child.skipPaths.isEmpty then base.skipPaths else child.skipPaths }

-- ============================================================================
-- Full GuardConfigs Merge
-- ============================================================================

/-- Merge two GuardConfigs.
    Mirrors `GuardConfigs::merge_with()` in policy.rs:281-369.

    The merge dispatches per-guard based on the guard's merge category:
    - Deep-merge guards use their own merge_with methods
    - Child-overrides guards use `childOverrides`

    When base is None but child exists, deep-merge guards merge child
    with a default config (preserving additive semantics). -/
noncomputable def GuardConfigs.mergeWith (base child : GuardConfigs) : GuardConfigs :=
  { forbiddenPath := match base.forbiddenPath, child.forbiddenPath with
      | some b, some c => some (ForbiddenPathConfig.mergeWith b c)
      | some b, none   => some b
      -- When base is None, merge child with default to apply additional_patterns
      | none,   some c => some (ForbiddenPathConfig.mergeWith
          { enabled := true, patterns := none, exceptions := [],
            additionalPatterns := [], removePatterns := [] } c)
      | none,   none   => none
  , pathAllowlist := match base.pathAllowlist, child.pathAllowlist with
      | some b, some c => some (PathAllowlistConfig.mergeWith b c)
      | some b, none   => some b
      | none,   some c => some c
      | none,   none   => none
  , egressAllowlist := match base.egressAllowlist, child.egressAllowlist with
      | some b, some c => some (EgressAllowlistConfig.mergeWith b c)
      | some b, none   => some b
      | none,   some c => some (EgressAllowlistConfig.mergeWith EgressAllowlistConfig.defaults c)
      | none,   none   => none
  , secretLeak := match base.secretLeak, child.secretLeak with
      | some b, some c => some (SecretLeakConfig.mergeWith b c)
      | some b, none   => some b
      | none,   some c => some c  -- simplified; Rust merges with default
      | none,   none   => none
  , patchIntegrity := childOverrides base.patchIntegrity child.patchIntegrity
  , shellCommand := childOverrides base.shellCommand child.shellCommand
  , mcpTool := match base.mcpTool, child.mcpTool with
      | some b, some c => some (McpToolConfig.mergeWith b c)
      | some b, none   => some b
      | none,   some c => some (McpToolConfig.mergeWith McpToolConfig.defaults c)
      | none,   none   => none
  , promptInjection := childOverrides base.promptInjection child.promptInjection
  , jailbreak := childOverrides base.jailbreak child.jailbreak
  , computerUse := childOverrides base.computerUse child.computerUse
  , remoteDesktopSideChannel := childOverrides base.remoteDesktopSideChannel
      child.remoteDesktopSideChannel
  , inputInjectionCapability := childOverrides base.inputInjectionCapability
      child.inputInjectionCapability
  , spiderSense := childOverrides base.spiderSense child.spiderSense }

-- ============================================================================
-- Full Policy Merge
-- ============================================================================

/-- Merge two policies (parent extended by child).
    Mirrors the policy merge logic in the engine's extends resolution.

    The child's version, settings, and merge_strategy take precedence.
    Name falls back to parent if child name is empty.
    Guards are merged via GuardConfigs.mergeWith.
    The `extends_` field is set to `none` (chain is fully resolved). -/
noncomputable def Policy.mergeWith (parent child : Policy) : Policy :=
  { version := child.version
  , name := if child.name.isEmpty then parent.name else child.name
  , description := if child.description.isEmpty then parent.description else child.description
  , extends_ := none  -- extends chain is fully resolved
  , mergeStrategy := child.mergeStrategy
  , guards := GuardConfigs.mergeWith parent.guards child.guards
  , settings := child.settings }

-- ============================================================================
-- Abstract Restriction Model (for monotonicity proofs)
-- ============================================================================

/-- Abstract model of policy restrictiveness.
    Used for the monotonicity proofs (P5) where we need to reason about
    "at least as restrictive" without modeling each guard's full logic.

    `forbiddenCount` is an abstract measure of how many actions are denied.
    `failFast` is whether the engine stops on first denial. -/
structure PolicyRestriction where
  /-- Number of forbidden actions (abstract measure of restrictiveness). -/
  forbiddenCount : Nat
  /-- Whether fail-fast is enabled (more restrictive when true). -/
  failFast : Bool
  deriving Repr, BEq

/-- A policy is "at least as restrictive" as another if it forbids
    at least as many actions. -/
def PolicyRestriction.atLeastAsRestrictive (a b : PolicyRestriction) : Prop :=
  b.forbiddenCount ≤ a.forbiddenCount

/-- Deep-merge two policy restrictions.
    The result is the union of forbidden actions (additive). -/
def PolicyRestriction.deepMerge (base child : PolicyRestriction) : PolicyRestriction :=
  { forbiddenCount := base.forbiddenCount + child.forbiddenCount
  , failFast := base.failFast || child.failFast }

/-- Replace merge: child replaces base entirely. -/
def PolicyRestriction.replaceMerge (_base child : PolicyRestriction) : PolicyRestriction :=
  child

end ClawdStrike.Core
