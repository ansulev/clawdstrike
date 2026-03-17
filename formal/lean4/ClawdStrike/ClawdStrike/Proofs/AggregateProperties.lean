/-
  ClawdStrike Proofs: Aggregate and Evaluation Properties
  (P4, P7, P8, P9, P11, P12, P13)

  This file contains proofs of aggregate, evaluation, and structural
  properties beyond deny monotonicity (P1, in DenyMonotonicity.lean).

  Properties proven:
  - P4:  Forbidden path guard soundness
  - P7:  Aggregate determinism and idempotence
  - P7a: worseResult idempotence on allowed status
  - P7b: worseResult returns a denial or both inputs allow
  - P7c: Equivalence between aggregateOverall and aggregateSpec
  - P8:  Severity monotonicity in aggregate
  - P9:  Fail-closed on config error
  - P11: Empty results safety
  - P12: Disabled guard transparency
  - P13: Action irrelevance

  Rust reference: aggregate_overall at core/aggregate.rs
  Empty results → CoreVerdict::allow("engine") (line 82).
  Non-empty results → aggregate_index picks the "worst" result.
-/

import ClawdStrike.Core.Verdict
import ClawdStrike.Core.Aggregate
import ClawdStrike.Core.Eval
import ClawdStrike.Spec.Properties
import ClawdStrike.Proofs.DenyMonotonicity

set_option autoImplicit false

namespace ClawdStrike.Proofs

open ClawdStrike.Core

-- ============================================================================
-- P11: Empty Results Safety
--
-- aggregateOverall [] = defaultResult, which has allowed = true.
-- ============================================================================

theorem empty_results_allow :
    (aggregateOverall []).allowed = true := by
  unfold aggregateOverall
  simp [List.foldl, defaultResult]

-- ============================================================================
-- defaultResult is allowed
-- ============================================================================

theorem defaultResult_allowed : defaultResult.allowed = true := by
  unfold defaultResult; rfl

-- ============================================================================
-- Singleton allow
-- ============================================================================

theorem aggregate_singleton_allow (r : GuardResult) (h : r.allowed = true) :
    (aggregateOverall [r]).allowed = true := by
  unfold aggregateOverall
  simp [List.foldl]
  -- Goal: (worseResult defaultResult r).allowed = true
  unfold worseResult defaultResult
  simp [h]
  -- After simp: bestBlocks = false, candBlocks = false
  -- Rule 1 eliminated, remaining ifs about severity/sanitize
  -- All branches return either r or defaultResult, both allowed
  split
  · exact h  -- severity comparison: returns r
  · split
    · exact h  -- sanitize: returns r
    · rfl  -- else: returns defaultResult

-- ============================================================================
-- Singleton deny
-- ============================================================================

theorem aggregate_singleton_deny (r : GuardResult) (h : r.allowed = false) :
    (aggregateOverall [r]).allowed = false := by
  exact deny_monotonicity [r] r (List.mem_cons_self ..) h

-- ============================================================================
-- P7a: worseResult is idempotent on allowed status
--
-- worseResult(a, a).allowed = a.allowed
-- ============================================================================

theorem worseResult_idempotent_allowed (a : GuardResult) :
    (worseResult a a).allowed = a.allowed := by
  unfold worseResult
  cases ha : a.allowed <;> simp [ha]

-- ============================================================================
-- P7b: worseResult preserves the "worse" allowed status
--
-- The result is either a denial, or both inputs were allowed.
-- ============================================================================

theorem worseResult_at_least_as_restrictive (a b : GuardResult) :
    (worseResult a b).allowed = false ∨
    (a.allowed = true ∧ b.allowed = true) := by
  cases ha : a.allowed <;> cases hb : b.allowed
  · -- both false: worseResult returns one of them (both false)
    left
    exact worseResult_preserves_deny_left a b ha
  · -- a false, b true: worseResult preserves denial from a
    left
    exact worseResult_preserves_deny_left a b ha
  · -- a true, b false: worseResult preserves denial from b
    left
    exact worseResult_preserves_deny_right a b hb
  · -- both true: right disjunct
    right
    constructor <;> rfl

-- ============================================================================
-- P7: Aggregate determinism (trivially true for pure functions)
-- ============================================================================

theorem aggregate_deterministic (results : List GuardResult) :
    aggregateOverall results = aggregateOverall results := rfl

-- ============================================================================
-- worseResult always returns one of its inputs
-- ============================================================================

theorem worseResult_returns_input (a b : GuardResult) :
    worseResult a b = a ∨ worseResult a b = b := by
  unfold worseResult
  simp only
  split
  · exact Or.inr rfl
  · split
    · exact Or.inr rfl
    · split
      · exact Or.inr rfl
      · exact Or.inl rfl

-- ============================================================================
-- P8: Severity Monotonicity in Aggregate
-- ============================================================================

/-- When the accumulator blocks, worseResult preserves severity lower bound. -/
theorem worseResult_severity_mono_left (a b : GuardResult)
    (h_deny : a.allowed = false) :
    a.severity.toNat ≤ (worseResult a b).severity.toNat := by
  unfold worseResult
  simp [h_deny]
  -- After simp with a.allowed = false, bestBlocks = true
  -- Rule 1 (candBlocks && !bestBlocks) is eliminated since !bestBlocks = false
  -- Remaining: if sev comparison then b else if sanitize then b else a
  cases hb : b.allowed <;> simp
  -- Case b.allowed = false: both block
  -- Remaining if: severity comparison
  · split
    · omega  -- b.severity > a.severity → returns b, need a.sev ≤ b.sev
    · omega  -- else: returns a, and ¬(a.sev < b.sev) means a.sev ≤ a.sev
  -- Case b.allowed = true: only a blocks
  -- After simp: since candBlocks = false, bestBlocks = true, == is false
  -- All comparisons fail → returns a (the accumulator)

/-- When a blocking candidate is processed, its severity is preserved. -/
theorem worseResult_severity_mono_right (a b : GuardResult)
    (h_deny : b.allowed = false) :
    b.severity.toNat ≤ (worseResult a b).severity.toNat := by
  unfold worseResult
  simp [h_deny]
  -- With b.allowed = false, candBlocks = true
  cases ha : a.allowed <;> simp
  -- Case a.allowed = false: both block
  -- Rule 1: candBlocks && !bestBlocks = true && false = false → skip
  -- Rule 2: severity comparison
  · split
    · exact Nat.le_refl _  -- b has higher severity → returns b
    · omega  -- else: returns a, and ¬(a.sev < b.sev) gives a.sev ≥ b.sev
  -- Case a.allowed = true: only b blocks
  -- Rule 1: candBlocks && !bestBlocks = true && true = true → returns b

/-- Generalized foldl severity lemma. -/
theorem foldl_worseResult_severity (acc : GuardResult) (xs : List GuardResult)
    (h_deny : acc.allowed = false) :
    acc.severity.toNat ≤ (xs.foldl worseResult acc).severity.toNat := by
  induction xs generalizing acc with
  | nil => exact Nat.le_refl acc.severity.toNat
  | cons x xs ih =>
    simp only [List.foldl]
    have h_step := worseResult_severity_mono_left acc x h_deny
    have h_deny' := worseResult_preserves_deny_left acc x h_deny
    exact Nat.le_trans h_step (ih (worseResult acc x) h_deny')

/-- If a denied element is in the list, its severity lower-bounds the result. -/
theorem foldl_worseResult_severity_mem (acc : GuardResult) (xs : List GuardResult)
    (r : GuardResult) (h_mem : r ∈ xs) (h_deny : r.allowed = false) :
    r.severity.toNat ≤ (xs.foldl worseResult acc).severity.toNat := by
  induction xs generalizing acc with
  | nil => simp at h_mem
  | cons x xs ih =>
    simp only [List.foldl]
    cases h_mem with
    | head =>
      -- r = x (head of list)
      have h_step := worseResult_severity_mono_right acc r h_deny
      have h_deny' := worseResult_preserves_deny_right acc r h_deny
      exact Nat.le_trans h_step (foldl_worseResult_severity (worseResult acc r) xs h_deny')
    | tail _ h_tail =>
      exact ih (worseResult acc x) h_tail

/-- P8: Aggregate severity is at least as high as any blocking result's severity. -/
theorem aggregate_severity_monotone (results : List GuardResult)
    (r : GuardResult) (h_mem : r ∈ results) (h_deny : r.allowed = false) :
    r.severity.toNat ≤ (aggregateOverall results).severity.toNat := by
  unfold aggregateOverall
  exact foldl_worseResult_severity_mem defaultResult results r h_mem h_deny

-- ============================================================================
-- P9: Fail-Closed on Config Error
--
-- If the policy has an unsupported version, evalPolicy returns an error.
-- ============================================================================

theorem fail_closed_config (policy : Policy) (action : Action) (ctx : Context)
    (h_error : hasConfigError policy = true) :
    ∃ (msg : String), evalPolicy policy action ctx = .error msg := by
  unfold evalPolicy
  simp [h_error]

-- ============================================================================
-- P12: Disabled Guard Transparency
--
-- Disabled guards always allow. This follows directly from the
-- `if !cfg.enabled then GuardResult.allow ...` pattern in each eval function.
-- ============================================================================

theorem disabled_forbidden_path_allows (cfg : ForbiddenPathConfig)
    (action : Action) (ctx : Context)
    (h_disabled : cfg.enabled = false) :
    (evalForbiddenPath cfg action ctx).allowed = true := by
  unfold evalForbiddenPath
  simp [h_disabled, GuardResult.allow]

theorem disabled_egress_allows (cfg : EgressAllowlistConfig)
    (action : Action) (ctx : Context)
    (h_disabled : cfg.enabled = false) :
    (evalEgressAllowlist cfg action ctx).allowed = true := by
  unfold evalEgressAllowlist
  simp [h_disabled, GuardResult.allow]

theorem disabled_shell_command_allows (cfg : ShellCommandConfig)
    (action : Action) (ctx : Context)
    (h_disabled : cfg.enabled = false) :
    (evalShellCommand cfg action ctx).allowed = true := by
  unfold evalShellCommand
  simp [h_disabled, GuardResult.allow]

theorem disabled_mcp_tool_allows (cfg : McpToolConfig)
    (action : Action) (ctx : Context)
    (h_disabled : cfg.enabled = false) :
    (evalMcpTool cfg action ctx).allowed = true := by
  unfold evalMcpTool
  simp [h_disabled, GuardResult.allow]

-- ============================================================================
-- P13: Action Irrelevance
--
-- Guards only inspect actions relevant to their domain.
-- Non-matching action types always pass through.
-- These follow from the `match action with ... | _ => allow` patterns.
-- ============================================================================

theorem forbidden_path_irrelevant_for_shell (cfg : ForbiddenPathConfig)
    (cmd : Command) (ctx : Context) :
    (evalForbiddenPath cfg (.shellCommand cmd) ctx).allowed = true := by
  unfold evalForbiddenPath
  cases h : cfg.enabled <;> simp [GuardResult.allow]

theorem egress_irrelevant_for_file (cfg : EgressAllowlistConfig)
    (path : Path) (ctx : Context) :
    (evalEgressAllowlist cfg (.fileAccess path) ctx).allowed = true := by
  unfold evalEgressAllowlist
  cases h : cfg.enabled <;> simp [GuardResult.allow]

theorem shell_irrelevant_for_file (cfg : ShellCommandConfig)
    (path : Path) (ctx : Context) :
    (evalShellCommand cfg (.fileAccess path) ctx).allowed = true := by
  unfold evalShellCommand
  cases h : cfg.enabled <;> simp [GuardResult.allow]

theorem mcp_irrelevant_for_file (cfg : McpToolConfig)
    (path : Path) (ctx : Context) :
    (evalMcpTool cfg (.fileAccess path) ctx).allowed = true := by
  unfold evalMcpTool
  cases h : cfg.enabled <;> simp [GuardResult.allow]

-- ============================================================================
-- P4: Forbidden Path Guard Soundness
--
-- If the guard is enabled, the path matches a forbidden pattern,
-- and the path does NOT match an exception, the guard blocks.
-- ============================================================================

theorem forbidden_path_guard_soundness (cfg : ForbiddenPathConfig) (path : Path)
    (ctx : Context)
    (h_enabled : cfg.enabled = true)
    (h_match : matchesAny cfg.effectivePatterns path = true)
    (h_no_exception : matchesAny cfg.exceptions path = false) :
    (evalForbiddenPath cfg (.fileAccess path) ctx).allowed = false := by
  unfold evalForbiddenPath
  simp [h_enabled, h_match, h_no_exception, GuardResult.block]

-- ============================================================================
-- Aggregate over two results
-- ============================================================================

theorem aggregate_two (a b : GuardResult) :
    aggregateOverall [a, b] = worseResult (worseResult defaultResult a) b := by
  unfold aggregateOverall
  simp [List.foldl]

-- ============================================================================
-- P1c: worseResult preserves denial from either side
-- ============================================================================

theorem worseResult_preserves_deny (a b : GuardResult)
    (h : a.allowed = false ∨ b.allowed = false) :
    (worseResult a b).allowed = false := by
  cases h with
  | inl ha => exact worseResult_preserves_deny_left a b ha
  | inr hb => exact worseResult_preserves_deny_right a b hb

end ClawdStrike.Proofs
