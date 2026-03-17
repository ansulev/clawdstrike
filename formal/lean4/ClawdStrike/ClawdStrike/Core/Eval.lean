/-
  ClawdStrike Core: Guard Evaluation Functions

  This module defines the per-guard evaluation functions and the full policy
  evaluation pipeline. Each guard is modeled as a total function from
  (config, action, context) to GuardResult.

  The key insight (from the formal spec document, section 1.1) is that policy
  evaluation is **simpler than IMP**: no loops, no recursion, no state mutation
  during evaluation. Guards are pure functions of (action, config, context).

  Content-dependent guards (jailbreak, prompt injection, spider sense, etc.)
  are axiomatized as opaque total functions -- their verdicts depend on runtime
  content analysis, not structural policy properties.

  Axiomatized operations:
    - `globMatch`: glob pattern matching (provided by the `glob` crate in Rust)
    - `regexMatch`: regex pattern matching (provided by the `regex` crate in Rust)
    - `evalContentGuard`: content-dependent guard evaluation (opaque)
    - `defaultForbiddenPatterns`: the default forbidden path list (from Merge.lean)

  Rust source references:
    - Guard evaluation: crates/libs/clawdstrike/src/guards/ (per-guard files)
    - Engine pipeline: crates/libs/clawdstrike/src/engine.rs
    - Aggregation: crates/libs/clawdstrike/src/core/aggregate.rs
-/

import ClawdStrike.Core.Verdict
import ClawdStrike.Core.Aggregate
import ClawdStrike.Core.Merge

set_option autoImplicit false

namespace ClawdStrike.Core

noncomputable section

-- ============================================================================
-- Axiomatized Pattern Matching
-- ============================================================================

/-- Axiom: glob pattern matching is decidable.
    In the Rust implementation, this is provided by the `glob` crate.
    We axiomatize it because verifying glob semantics is out of scope. -/
axiom globMatch : GlobPattern → Path → Bool

/-- Check if any pattern in a list matches the given path. -/
def matchesAny (patterns : List GlobPattern) (path : Path) : Bool :=
  patterns.any (fun p => globMatch p path)

/-- Axiom: regex pattern matching is decidable.
    In the Rust implementation, this is provided by the `regex` crate.
    Shell command guard uses regex patterns, not glob patterns. -/
axiom regexMatch : String → Command → Bool

/-- Axiom: content-dependent guard evaluation is an opaque total function.
    Used for guards like secret_leak, patch_integrity, prompt_injection,
    jailbreak, computer_use, remote_desktop_side_channel,
    input_injection_capability, and spider_sense. -/
axiom evalContentGuard : String → Action → Context → GuardResult

-- ============================================================================
-- Per-Guard Evaluation Functions
-- ============================================================================

/-- Evaluate the ForbiddenPathGuard.
    Mirrors the `check()` method in guards/forbidden_path.rs.

    Applies to: FileAccess, FileWrite, Patch actions.
    - Computes effective patterns from the config.
    - If the path matches any forbidden pattern AND does not match any exception,
      the action is blocked.
    - Otherwise, the action is allowed.
    - Non-path actions always pass. -/
def evalForbiddenPath (cfg : ForbiddenPathConfig) (action : Action) (_ : Context) : GuardResult :=
  if !cfg.enabled then GuardResult.allow "forbidden_path"
  else match action with
  | .fileAccess path | .fileWrite path _ | .patch path _ =>
    let patterns := cfg.effectivePatterns
    if matchesAny patterns path && !matchesAny cfg.exceptions path then
      GuardResult.block "forbidden_path" .error s!"Access to {path} is forbidden"
    else
      GuardResult.allow "forbidden_path"
  | _ => GuardResult.allow "forbidden_path"

/-- Evaluate the PathAllowlistGuard.
    Mirrors the `check()` method in guards/path_allowlist.rs.

    When enabled, the guard denies access to any path NOT in the allowlist.
    Uses separate allowlists for file_access, file_write, and patch actions. -/
def evalPathAllowlist (cfg : PathAllowlistConfig) (action : Action) (_ : Context) : GuardResult :=
  if !cfg.enabled then GuardResult.allow "path_allowlist"
  else match action with
  | .fileAccess path =>
    if matchesAny cfg.fileAccessAllow path then
      GuardResult.allow "path_allowlist"
    else
      GuardResult.block "path_allowlist" .error s!"Access to {path} is not in allowlist"
  | .fileWrite path _ =>
    if matchesAny cfg.fileWriteAllow path then
      GuardResult.allow "path_allowlist"
    else
      GuardResult.block "path_allowlist" .error s!"Write to {path} is not in allowlist"
  | .patch path _ =>
    -- Patch falls back to fileWriteAllow when patchAllow is empty
    let patterns := if cfg.patchAllow.isEmpty then cfg.fileWriteAllow else cfg.patchAllow
    if matchesAny patterns path then
      GuardResult.allow "path_allowlist"
    else
      GuardResult.block "path_allowlist" .error s!"Patch to {path} is not in allowlist"
  | _ => GuardResult.allow "path_allowlist"

/-- Evaluate the EgressAllowlistGuard.
    Mirrors the `check()` method in guards/egress_allowlist.rs.

    Evaluation order follows block > allow > default precedence:
    1. If domain is in the block list, deny.
    2. If domain is in the allow list, allow.
    3. Otherwise, apply the default action (block by default).

    Note: In the real implementation, domain matching uses glob-style wildcards
    (e.g., "*.openai.com"). For the spec, we use exact string matching via
    `List.elem`. The axiomatized `globMatch` could be used for a richer model. -/
def evalEgressAllowlist (cfg : EgressAllowlistConfig) (action : Action) (_ : Context)
    : GuardResult :=
  if !cfg.enabled then GuardResult.allow "egress_allowlist"
  else match action with
  | .networkEgress domain _ =>
    if cfg.block.contains domain then
      GuardResult.block "egress_allowlist" .error
        s!"Egress to {domain} is explicitly blocked"
    else if cfg.allow.contains domain then
      GuardResult.allow "egress_allowlist"
    else
      -- Neither explicitly allowed nor blocked: apply default
      match cfg.defaultAction with
      | some .block => GuardResult.block "egress_allowlist" .error
          s!"Egress to {domain} is not in allowlist (default: block)"
      | _ => GuardResult.allow "egress_allowlist"
  | _ => GuardResult.allow "egress_allowlist"

/-- Evaluate the ShellCommandGuard.
    Mirrors the `check()` method in guards/shell_command.rs.

    Uses regex matching (axiomatized) against forbidden patterns.
    Note: the real guard also extracts path tokens from commands and checks
    them against ForbiddenPathGuard. This interaction is simplified here. -/
def evalShellCommand (cfg : ShellCommandConfig) (action : Action) (_ : Context) : GuardResult :=
  if !cfg.enabled then GuardResult.allow "shell_command"
  else match action with
  | .shellCommand cmd =>
    if cfg.forbiddenPatterns.any (fun pat => regexMatch pat cmd) then
      GuardResult.block "shell_command" .error s!"Command matches forbidden pattern"
    else
      GuardResult.allow "shell_command"
  | _ => GuardResult.allow "shell_command"

/-- Evaluate the McpToolGuard.
    Mirrors the `check()` method in guards/mcp_tool.rs.

    Evaluation order: block > allow > default.
    1. If tool is in the block list, deny.
    2. If tool is in the allow list, allow.
    3. Otherwise, apply the default action (allow by default). -/
def evalMcpTool (cfg : McpToolConfig) (action : Action) (_ : Context) : GuardResult :=
  if !cfg.enabled then GuardResult.allow "mcp_tool"
  else match action with
  | .mcpTool tool _ =>
    if cfg.block.contains tool then
      GuardResult.block "mcp_tool" .error s!"MCP tool '{tool}' is blocked"
    else if cfg.allow.isEmpty || cfg.allow.contains tool then
      -- If allow list is empty, all non-blocked tools pass (when default is allow)
      -- If allow list is non-empty and tool is in it, allow
      GuardResult.allow "mcp_tool"
    else
      -- Tool not in allow list and allow list is non-empty
      match cfg.defaultAction with
      | some .block => GuardResult.block "mcp_tool" .error
          s!"MCP tool '{tool}' is not in allowlist (default: block)"
      | _ => GuardResult.allow "mcp_tool"
  | _ => GuardResult.allow "mcp_tool"

-- ============================================================================
-- Unified Guard Dispatch
-- ============================================================================

/-- Evaluate all configured guards against an action.
    Mirrors the guard evaluation pipeline in engine.rs.

    Returns a list of GuardResults -- one per enabled guard.
    Guards that are `none` (not configured) are skipped.
    Content-dependent guards check their `enabled` flag. -/
def evalGuards (cfg : GuardConfigs) (action : Action) (ctx : Context) : List GuardResult :=
  let results : List (Option GuardResult) := [
    cfg.forbiddenPath.map (fun c => evalForbiddenPath c action ctx),
    cfg.pathAllowlist.map (fun c => evalPathAllowlist c action ctx),
    cfg.egressAllowlist.map (fun c => evalEgressAllowlist c action ctx),
    cfg.shellCommand.map (fun c => evalShellCommand c action ctx),
    cfg.mcpTool.map (fun c => evalMcpTool c action ctx),
    cfg.secretLeak.map (fun _ => evalContentGuard "secret_leak" action ctx),
    cfg.patchIntegrity.map (fun _ => evalContentGuard "patch_integrity" action ctx),
    cfg.promptInjection.bind (fun c =>
      if c.enabled then some (evalContentGuard "prompt_injection" action ctx) else none),
    cfg.jailbreak.bind (fun c =>
      if c.enabled then some (evalContentGuard "jailbreak" action ctx) else none),
    cfg.computerUse.map (fun _ => evalContentGuard "computer_use" action ctx),
    cfg.remoteDesktopSideChannel.map
      (fun _ => evalContentGuard "remote_desktop_side_channel" action ctx),
    cfg.inputInjectionCapability.map
      (fun _ => evalContentGuard "input_injection_capability" action ctx),
    cfg.spiderSense.map (fun _ => evalContentGuard "spider_sense" action ctx)
  ]
  results.filterMap id

-- ============================================================================
-- Config Error Check
-- ============================================================================

/-- Check if a policy has a configuration error (unsupported version).
    Mirrors the version check in the Rust engine initialization. -/
def hasConfigError (policy : Policy) : Bool :=
  !supportedVersions.contains policy.version

-- ============================================================================
-- Full Policy Evaluation
-- ============================================================================

/-- Full policy evaluation. Top-level function that the implementation must
    agree with.

    Mirrors the evaluation pipeline in engine.rs:
    1. Check for config errors (unsupported version → fail closed)
    2. Evaluate all guards against the action
    3. If fail-fast is enabled, short-circuit on first denial
    4. Aggregate results via worseResult fold

    Returns `Except.error` on config error, `Except.ok` with the aggregate
    verdict otherwise. -/
def evalPolicy (policy : Policy) (action : Action) (ctx : Context)
    : Except String GuardResult :=
  if hasConfigError policy then
    .error s!"Unsupported schema version"
  else
    let results := evalGuards policy.guards action ctx
    let effectiveResults :=
      if policy.settings.effectiveFailFast then
        match results.find? (fun r => !r.allowed) with
        | some firstDeny => [firstDeny]
        | none => results
      else
        results
    .ok (aggregateOverall effectiveResults)

end

end ClawdStrike.Core
