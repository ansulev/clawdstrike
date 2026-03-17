/-
  ClawdStrike Formal Specification: Properties

  Core properties that the policy engine must satisfy.
  These theorem statements define WHAT we want to prove.
  32 of 35 theorems are fully proved; 3 remain `sorry` (see below).

  Property numbering follows the formal verification specification document
  (docs/plans/clawdstrike/formal-verification/policy-specification.md).

  Properties:
    P1: Deny Monotonicity (THE critical safety property)
    P2: Allow Requires Unanimity (contrapositive of P1)
    P3: Severity Total Order
    P4: Forbidden Path Soundness
    P5: Inheritance Restrictiveness (merge preserves denials)
    P6: Merge Idempotence
    P7: Aggregate Determinism and Idempotence
    P8: Severity Monotonicity in Aggregate
    P9: Fail-Closed on Config Error
    P10: Cycle Detection Correctness
    P11: Empty Results Safety
-/

import ClawdStrike.Core.Verdict
import ClawdStrike.Core.Aggregate
import ClawdStrike.Core.Merge
import ClawdStrike.Core.Cycle
import ClawdStrike.Core.Eval

set_option autoImplicit false

namespace ClawdStrike.Spec

open ClawdStrike.Core

-- ============================================================================
-- Helper lemmas for deny monotonicity (needed locally since we don't import Proofs/)
-- ============================================================================

private theorem foldl_worseResult_deny (acc : GuardResult) (xs : List GuardResult)
    (h : acc.allowed = false) :
    (xs.foldl worseResult acc).allowed = false := by
  induction xs generalizing acc with
  | nil => exact h
  | cons x xs ih =>
    simp only [List.foldl]
    apply ih
    unfold worseResult
    simp only [h]
    cases hc : x.allowed
    · simp; split <;> simp_all
    · simp; exact h

private theorem worseResult_preserves_deny_right' (a b : GuardResult)
    (h : b.allowed = false) :
    (worseResult a b).allowed = false := by
  unfold worseResult
  simp only [h]
  cases hb : a.allowed
  · simp; split <;> simp_all
  · simp; exact h

private theorem foldl_worseResult_deny_mem (acc : GuardResult) (xs : List GuardResult)
    (r : GuardResult) (h_mem : r ∈ xs) (h_deny : r.allowed = false) :
    (xs.foldl worseResult acc).allowed = false := by
  induction xs generalizing acc with
  | nil => simp at h_mem
  | cons _ ys ih =>
    simp only [List.foldl]
    cases h_mem with
    | head =>
      exact foldl_worseResult_deny _ ys
        (worseResult_preserves_deny_right' acc _ h_deny)
    | tail _ h_tail =>
      exact ih _ h_tail

-- ============================================================================
-- P1: Deny Monotonicity (THE critical safety property)
--
-- "If any guard says deny, the aggregate says deny."
-- This is the fail-closed guarantee. Without it, a single guard's denial
-- could be silently overridden by another guard's approval.
--
-- Rust: aggregate_overall in core/aggregate.rs always picks the "worst"
-- result, and blocking (allowed=false) always beats non-blocking.
-- ============================================================================

/-- P1: Deny Monotonicity
    If any guard result in the list has allowed=false,
    then aggregateOverall returns allowed=false. -/
theorem deny_monotonicity (results : List GuardResult) (r : GuardResult)
    (h_mem : r ∈ results) (h_deny : r.allowed = false) :
    (aggregateOverall results).allowed = false := by
  unfold aggregateOverall
  exact foldl_worseResult_deny_mem defaultResult results r h_mem h_deny

/-- P1a: worseResult preserves denial from the accumulator (left argument).
    If the accumulator denies, worseResult preserves the denial regardless
    of what the candidate is. -/
theorem worseResult_preserves_deny_left (a b : GuardResult)
    (h : a.allowed = false) :
    (worseResult a b).allowed = false := by
  unfold worseResult
  simp only [h]
  cases hc : b.allowed
  · simp; split <;> simp_all
  · simp; exact h

/-- P1b: worseResult preserves denial from the candidate (right argument).
    If the candidate denies, worseResult produces a denial regardless
    of what the accumulator is. -/
theorem worseResult_preserves_deny_right (a b : GuardResult)
    (h : b.allowed = false) :
    (worseResult a b).allowed = false := by
  unfold worseResult
  simp only [h]
  cases hb : a.allowed
  · simp; split <;> simp_all
  · simp; exact h

/-- P1c: worseResult preserves denial from either side (combined).
    This is the key lemma for the deny_monotonicity proof:
    if either input denies, the output denies. -/
theorem worseResult_preserves_deny (a b : GuardResult)
    (h : a.allowed = false ∨ b.allowed = false) :
    (worseResult a b).allowed = false := by
  cases h with
  | inl ha => exact worseResult_preserves_deny_left a b ha
  | inr hb => exact worseResult_preserves_deny_right a b hb

-- ============================================================================
-- P2: Allow Requires Unanimity
--
-- "The aggregate allows only if ALL guards allow."
-- This is the contrapositive of P1, stated directly.
-- ============================================================================

/-- P2: Allow Requires Unanimity
    If the aggregate allows, then every guard in the list must allow. -/
theorem allow_requires_unanimity (results : List GuardResult)
    (h_allow : (aggregateOverall results).allowed = true)
    (r : GuardResult) (h_mem : r ∈ results) :
    r.allowed = true := by
  cases hr : r.allowed with
  | false =>
    have h_agg_deny := deny_monotonicity results r h_mem hr
    simp [h_agg_deny] at h_allow
  | true => rfl

-- ============================================================================
-- P3: Severity Total Order
--
-- Severity values form a total order via toNat.
-- Required for the aggregate comparison logic to be well-defined.
-- ============================================================================

/-- P3: Severity Total Order
    For any two severities, one is <= the other. -/
theorem severity_total_order (a b : Severity) :
    a ≤ b ∨ b ≤ a := by
  show a.toNat ≤ b.toNat ∨ b.toNat ≤ a.toNat
  exact Nat.le_total a.toNat b.toNat

/-- P3a: Severity order is transitive. -/
theorem severity_le_trans (a b c : Severity)
    (h1 : a ≤ b) (h2 : b ≤ c) : a ≤ c := by
  show a.toNat ≤ c.toNat
  exact Nat.le_trans h1 h2

/-- P3b: Severity order is antisymmetric with respect to toNat equality. -/
theorem severity_le_antisymm (a b : Severity)
    (h1 : a ≤ b) (h2 : b ≤ a) : a = b := by
  have h_eq : a.toNat = b.toNat := Nat.le_antisymm h1 h2
  exact Severity.toNat_injective a b h_eq

/-- P3c: Severity toNat is injective (equal ordinals imply equal severities). -/
theorem severity_toNat_injective (a b : Severity)
    (h : a.toNat = b.toNat) : a = b := by
  cases a <;> cases b <;> simp [Severity.toNat] at h <;> rfl

-- ============================================================================
-- P4: Forbidden Path Soundness
--
-- If a policy has a forbidden_path guard with effective patterns, and an
-- action accesses a path matching one of those patterns (and not matching
-- any exception), then the overall verdict is deny.
-- ============================================================================

/-- P4: Forbidden Path Soundness
    If the forbidden_path guard is enabled, the path matches a forbidden
    pattern, and the path does NOT match an exception, then the guard
    produces a denial. -/
theorem forbidden_path_guard_soundness (cfg : ForbiddenPathConfig) (path : Path)
    (ctx : Context)
    (h_enabled : cfg.enabled = true)
    (h_match : matchesAny cfg.effectivePatterns path = true)
    (h_no_exception : matchesAny cfg.exceptions path = false) :
    (evalForbiddenPath cfg (.fileAccess path) ctx).allowed = false := by
  unfold evalForbiddenPath
  simp [h_enabled, h_match, h_no_exception, GuardResult.block]

/-- P4a: Forbidden Path Soundness (end-to-end via policy evaluation).
    If a policy has an enabled forbidden_path guard, and the action matches
    a forbidden pattern without exception, then the policy evaluation denies. -/
theorem forbidden_path_policy_soundness (policy : Policy) (path : Path)
    (ctx : Context) (cfg : ForbiddenPathConfig)
    (h_guard : policy.guards.forbiddenPath = some cfg)
    (h_enabled : cfg.enabled = true)
    (h_match : matchesAny cfg.effectivePatterns path = true)
    (h_no_exception : matchesAny cfg.exceptions path = false)
    (h_no_error : hasConfigError policy = false) :
    ∃ (result : GuardResult),
      evalPolicy policy (.fileAccess path) ctx = .ok result ∧
      result.allowed = false := by
  sorry

-- ============================================================================
-- P5: Inheritance Restrictiveness (Merge Preserves Denials)
--
-- If a child policy's evaluation denies an action, then the merged policy
-- (parent extended by child) also denies that action.
-- This ensures that policy inheritance never weakens security.
-- ============================================================================

/-- P5: Inheritance Restrictiveness (abstract model).
    DeepMerge is monotonically restrictive: the merged result forbids at
    least as many actions as the base. -/
theorem deepMerge_monotone (base child : PolicyRestriction) :
    PolicyRestriction.atLeastAsRestrictive
      (PolicyRestriction.deepMerge base child) base := by
  unfold PolicyRestriction.atLeastAsRestrictive PolicyRestriction.deepMerge
  simp

/-- Helper: A ForbiddenPathConfig with explicit patterns and empty add/remove lists. -/
private noncomputable def cleanFPConfig (en : Bool) (ps : List GlobPattern) (exns : List GlobPattern) : ForbiddenPathConfig :=
  { enabled := en, patterns := some ps, exceptions := exns,
    additionalPatterns := [], removePatterns := [] }

/-- Helper: effectivePatterns of a clean config equals the explicit patterns. -/
private theorem effectivePatterns_clean (en : Bool) (ps : List GlobPattern) (exns : List GlobPattern) :
    (cleanFPConfig en ps exns).effectivePatterns = ps := by
  unfold cleanFPConfig ForbiddenPathConfig.effectivePatterns
  simp only [List.filter_nil, List.append_nil]
  induction ps with
  | nil => rfl
  | cons x xs ih =>
    simp only [List.filter, List.contains]
    exact congrArg (x :: ·) ih

/-- Helper: mergeWith with child.patterns = none produces a clean config. -/
private noncomputable def mergedFinalPatterns (base child : ForbiddenPathConfig) : List GlobPattern :=
  let startPatterns := base.effectivePatterns
  let withAdditions := startPatterns ++ child.additionalPatterns.filter
    (fun p => !startPatterns.contains p)
  withAdditions.filter (fun p => !child.removePatterns.contains p)

private theorem mergeWith_clean (base child : ForbiddenPathConfig)
    (h : child.patterns = none) :
    ForbiddenPathConfig.mergeWith base child =
    cleanFPConfig child.enabled (mergedFinalPatterns base child)
      (base.exceptions ++ child.exceptions.filter (fun e => !base.exceptions.contains e)) := by
  unfold ForbiddenPathConfig.mergeWith mergedFinalPatterns cleanFPConfig
  simp [h]

/-- Helper: ¬(p ∈ xs) implies xs.contains p = false. -/
private theorem not_mem_contains_false (xs : List String) (p : String) (h : ¬(p ∈ xs)) :
    xs.contains p = false := by
  cases hc : xs.contains p
  · rfl
  · exact absurd (List.contains_iff_mem.mp hc) h

/-- P5a: ForbiddenPath merge preserves base patterns.
    After merging, the effective patterns include all of the base's
    effective patterns that are not removed by the child.

    Precondition: child.patterns = none (child uses additionalPatterns/removePatterns
    only, not a full replacement). When child.patterns = some ps, the child's
    explicit patterns REPLACE the base entirely, so base patterns are NOT preserved. -/
theorem forbidden_path_merge_preserves_base (base child : ForbiddenPathConfig)
    (p : GlobPattern)
    (h_in_base : p ∈ base.effectivePatterns)
    (h_not_removed : ¬ (p ∈ child.removePatterns))
    (h_child_no_explicit : child.patterns = none) :
    p ∈ (ForbiddenPathConfig.mergeWith base child).effectivePatterns := by
  rw [mergeWith_clean base child h_child_no_explicit]
  rw [effectivePatterns_clean]
  unfold mergedFinalPatterns
  apply List.mem_filter.mpr
  refine ⟨List.mem_append_left _ h_in_base, ?_⟩
  rw [Bool.not_eq_true', not_mem_contains_false child.removePatterns p h_not_removed]

/-- P5b: ForbiddenPath merge includes child additions.
    After merging, the effective patterns include the child's
    additional_patterns (unless removed by the child itself). -/
theorem forbidden_path_merge_includes_additions (base child : ForbiddenPathConfig)
    (p : GlobPattern)
    (h_in_additional : p ∈ child.additionalPatterns)
    (h_not_removed : ¬ (p ∈ child.removePatterns))
    (h_child_no_explicit : child.patterns = none) :
    p ∈ (ForbiddenPathConfig.mergeWith base child).effectivePatterns := by
  sorry

-- ============================================================================
-- P6: Merge Idempotence
--
-- Merging a policy with itself produces a policy that evaluates identically
-- to the original.
-- ============================================================================

/-- P6: Merge Idempotence (for childOverrides combinator).
    childOverrides is trivially idempotent. -/
theorem childOverrides_idempotent {α : Type} (x : Option α) :
    childOverrides x x = x := by
  unfold childOverrides
  cases x <;> rfl

/-- P6a: Merge Idempotence (for full policy evaluation).
    Merging a policy with itself yields the same evaluation result. -/
theorem merge_policy_idempotent (policy : Policy) (action : Action) (ctx : Context) :
    evalPolicy (Policy.mergeWith policy policy) action ctx =
    evalPolicy policy action ctx := by
  sorry

-- ============================================================================
-- P7: Aggregate Determinism and Idempotence
--
-- Supporting properties for the aggregate logic.
-- ============================================================================

/-- P7: Aggregate is deterministic (trivial -- it is a pure function).
    The same input always produces the same output. -/
theorem aggregate_deterministic (results : List GuardResult) :
    aggregateOverall results = aggregateOverall results := by
  rfl

/-- P7a: worseResult is idempotent on denial status.
    worseResult(a, a) has the same allowed status as a. -/
theorem worseResult_idempotent_allowed (a : GuardResult) :
    (worseResult a a).allowed = a.allowed := by
  unfold worseResult
  cases ha : a.allowed <;> simp [ha]

/-- P7b: worseResult preserves the "worse" allowed status.
    The result of worseResult is at least as restrictive as either input. -/
theorem worseResult_at_least_as_restrictive (a b : GuardResult) :
    (worseResult a b).allowed = false ∨
    (a.allowed = true ∧ b.allowed = true) := by
  cases ha : a.allowed <;> cases hb : b.allowed
  · left; exact worseResult_preserves_deny_left a b ha
  · left; exact worseResult_preserves_deny_left a b ha
  · left; exact worseResult_preserves_deny_right a b hb
  · right; constructor <;> rfl

/-- Helper: worseResult defaultResult r agrees with r on allowed, severity, and sanitized.
    defaultResult is (true, info, false), which is the "weakest" possible result,
    so worseResult always either returns the candidate or returns a value with
    the same decision-relevant fields. -/
private theorem worseResult_default_decision_fields (r : GuardResult) :
    (worseResult defaultResult r).allowed = r.allowed ∧
    (worseResult defaultResult r).severity = r.severity ∧
    (worseResult defaultResult r).sanitized = r.sanitized := by
  unfold worseResult defaultResult
  -- Exhaustive case split on the three decision-relevant fields of r
  cases hr : r.allowed <;> cases hs : r.severity <;> cases hsan : r.sanitized <;>
    simp_all [Severity.toNat]

/-- Helper: if two GuardResults agree on allowed, severity, and sanitized,
    then worseResult with any common candidate also agrees on these fields. -/
private theorem worseResult_congr_decision (a b c : GuardResult)
    (ha : a.allowed = b.allowed) (hs : a.severity = b.severity)
    (hsan : a.sanitized = b.sanitized) :
    (worseResult a c).allowed = (worseResult b c).allowed ∧
    (worseResult a c).severity = (worseResult b c).severity ∧
    (worseResult a c).sanitized = (worseResult b c).sanitized := by
  -- worseResult selects between best and candidate based on allowed, severity, sanitized.
  -- Since a and b agree on these fields, both calls take the same branch.
  -- When both return candidate (c), fields trivially agree.
  -- When both return best (a vs b), they agree by hypothesis.
  unfold worseResult
  simp only [ha, hs, hsan]
  -- After rewriting, all branch conditions are identical between the two sides.
  -- The only difference is in the else-else-else branch: returns a vs b.
  -- In that branch, the fields agree by hypothesis.
  split <;> simp_all
  split <;> simp_all
  split <;> simp_all

/-- Helper: foldl worseResult preserves agreement on allowed, severity, sanitized. -/
private theorem foldl_worseResult_congr_decision (a b : GuardResult) (xs : List GuardResult)
    (ha : a.allowed = b.allowed) (hs : a.severity = b.severity)
    (hsan : a.sanitized = b.sanitized) :
    (xs.foldl worseResult a).allowed = (xs.foldl worseResult b).allowed ∧
    (xs.foldl worseResult a).severity = (xs.foldl worseResult b).severity ∧
    (xs.foldl worseResult a).sanitized = (xs.foldl worseResult b).sanitized := by
  induction xs generalizing a b with
  | nil => exact ⟨ha, hs, hsan⟩
  | cons x xs ih =>
    simp only [List.foldl]
    have h := worseResult_congr_decision a b x ha hs hsan
    exact ih _ _ h.1 h.2.1 h.2.2

/-- P7c: Weak equivalence between aggregateOverall and aggregateSpec.
    The foldl-based definition and the spec's pattern-match form agree
    on the decision-relevant fields (allowed and severity).

    They may differ on non-decision fields (guardName, message) because
    defaultResult.message = "No guards matched" while
    aggregateSpec's empty-case default has message = "Allowed".
    This difference is cosmetic and does not affect security properties. -/
theorem aggregate_forms_equivalent (results : List GuardResult) :
    (aggregateOverall results).allowed = (aggregateSpec results).allowed ∧
    (aggregateOverall results).severity = (aggregateSpec results).severity := by
  unfold aggregateOverall aggregateSpec
  cases results with
  | nil =>
    -- Both produce an allow with info severity
    simp [List.foldl, defaultResult, GuardResult.allow]
  | cons r rs =>
    -- aggregateOverall: (r :: rs).foldl worseResult defaultResult
    --                 = rs.foldl worseResult (worseResult defaultResult r)
    -- aggregateSpec:    rs.foldl worseResult r
    simp only [List.foldl]
    have h := worseResult_default_decision_fields r
    have h' := foldl_worseResult_congr_decision _ _ rs h.1 h.2.1 h.2.2
    exact ⟨h'.1, h'.2.1⟩

-- ============================================================================
-- P8: Severity Monotonicity in Aggregate
--
-- The aggregate severity is >= every individual severity when blocking.
-- This ensures the most severe violation is reported.
-- ============================================================================

/-- Helper: worseResult preserves severity lower bound from left when blocking. -/
private theorem worseResult_severity_mono_left (a b : GuardResult)
    (h_deny : a.allowed = false) :
    a.severity.toNat ≤ (worseResult a b).severity.toNat := by
  unfold worseResult
  simp [h_deny]
  cases hb : b.allowed <;> simp
  · split
    · omega
    · omega

/-- Helper: worseResult preserves severity lower bound from right when blocking. -/
private theorem worseResult_severity_mono_right (a b : GuardResult)
    (h_deny : b.allowed = false) :
    b.severity.toNat ≤ (worseResult a b).severity.toNat := by
  unfold worseResult
  simp [h_deny]
  cases ha : a.allowed <;> simp
  · split
    · exact Nat.le_refl _
    · omega

/-- Helper: foldl preserves severity lower bound from accumulator. -/
private theorem foldl_worseResult_severity (acc : GuardResult) (xs : List GuardResult)
    (h_deny : acc.allowed = false) :
    acc.severity.toNat ≤ (xs.foldl worseResult acc).severity.toNat := by
  induction xs generalizing acc with
  | nil => exact Nat.le_refl acc.severity.toNat
  | cons x xs ih =>
    simp only [List.foldl]
    have h_step := worseResult_severity_mono_left acc x h_deny
    have h_deny' := worseResult_preserves_deny_left acc x h_deny
    exact Nat.le_trans h_step (ih (worseResult acc x) h_deny')

/-- Helper: foldl preserves severity lower bound from a member. -/
private theorem foldl_worseResult_severity_mem (acc : GuardResult) (xs : List GuardResult)
    (r : GuardResult) (h_mem : r ∈ xs) (h_deny : r.allowed = false) :
    r.severity.toNat ≤ (xs.foldl worseResult acc).severity.toNat := by
  induction xs generalizing acc with
  | nil => simp at h_mem
  | cons x xs ih =>
    simp only [List.foldl]
    cases h_mem with
    | head =>
      have h_step := worseResult_severity_mono_right acc r h_deny
      have h_deny' := worseResult_preserves_deny_right acc r h_deny
      exact Nat.le_trans h_step (foldl_worseResult_severity (worseResult acc r) xs h_deny')
    | tail _ h_tail =>
      exact ih (worseResult acc x) h_tail

/-- P8: The aggregate severity is at least as high as any blocking result's severity.
    If a blocking result is in the list, the aggregate severity >= that
    result's severity. -/
theorem aggregate_severity_monotone (results : List GuardResult)
    (r : GuardResult) (h_mem : r ∈ results) (h_deny : r.allowed = false) :
    r.severity.toNat ≤ (aggregateOverall results).severity.toNat := by
  unfold aggregateOverall
  exact foldl_worseResult_severity_mem defaultResult results r h_mem h_deny

-- ============================================================================
-- P9: Fail-Closed on Config Error
--
-- If the policy has a configuration error (unsupported version),
-- evaluation returns Except.error. The engine never silently proceeds
-- with a misconfigured policy.
-- ============================================================================

/-- P9: Fail-closed on config error.
    If the policy has an unsupported version, evalPolicy returns an error. -/
theorem fail_closed_config (policy : Policy) (action : Action) (ctx : Context)
    (h_error : hasConfigError policy = true) :
    ∃ (msg : String), evalPolicy policy action ctx = .error msg := by
  unfold evalPolicy
  simp [h_error]

-- ============================================================================
-- P10: Cycle Detection Correctness
--
-- Policy resolution with `extends` always terminates.
-- The visited-set grows monotonically and the fuel decreases,
-- so resolveChain always returns.
-- ============================================================================

/-- P10: If a key is already visited, checkExtendsCycle detects the cycle. -/
theorem cycle_detected_if_visited (key : String) (visited : Visited) (depth : Nat)
    (h_visited : visited.contains key = true)
    (h_depth : depth ≤ maxExtendsDepth) :
    checkExtendsCycle key visited depth = .cycleDetected key := by
  unfold checkExtendsCycle
  simp [Nat.not_lt.mpr h_depth, h_visited]

/-- P10a: If a key is already visited, resolveChain detects the cycle. -/
theorem resolveChain_cycle_detected (lookup : String → Option PolicyNode)
    (key : String) (visited : Visited) (fuel : Nat)
    (h_visited : visited.contains key = true)
    (h_fuel : fuel > 0) :
    ∃ k, resolveChain lookup key visited fuel = .cycleDetected k := by
  match fuel, h_fuel with
  | n + 1, _ =>
    exists key
    unfold resolveChain
    simp [h_visited]

/-- P10b: resolveChain with zero fuel always terminates (with depth exceeded). -/
theorem zero_fuel_terminates (lookup : String → Option PolicyNode)
    (key : String) (visited : Visited) :
    ∃ n, resolveChain lookup key visited 0 = .depthExceeded n := by
  exact ⟨visited.length, rfl⟩

/-- P10c: Depth exceeding the limit is detected. -/
theorem depth_exceeded_detected (key : String) (visited : Visited) (depth : Nat)
    (h_deep : depth > maxExtendsDepth) :
    checkExtendsCycle key visited depth = .depthExceeded depth maxExtendsDepth := by
  unfold checkExtendsCycle
  simp [h_deep]

-- ============================================================================
-- P11: Empty Results Safety
--
-- "No guards => allow." The engine returns a default allow result
-- when no guards match. This is safe because the absence of guards
-- means no security-relevant action was detected.
-- ============================================================================

/-- P11: Empty list produces an allow verdict. -/
theorem empty_results_allow :
    (aggregateOverall []).allowed = true := by
  unfold aggregateOverall
  simp [List.foldl, defaultResult]

/-- P11a: A policy with no guards configured produces an allow verdict
    (assuming no config error). -/
theorem no_guards_allow (action : Action) (ctx : Context) :
    evalPolicy { guards := {} } action ctx = .ok (defaultResult) := by
  unfold evalPolicy
  -- hasConfigError on default policy (version = currentSchemaVersion) is false
  have h_no_err : hasConfigError { guards := ({} : GuardConfigs) } = false := by native_decide
  simp [h_no_err]
  -- evalGuards with all guards = none produces []
  unfold evalGuards
  simp [List.filterMap]
  -- aggregateOverall [] = defaultResult
  unfold aggregateOverall
  simp [List.foldl]

-- ============================================================================
-- P12: Disabled Guard Transparency
--
-- A disabled guard does not affect the verdict. This ensures that
-- operators can safely disable guards without unexpected side effects.
-- ============================================================================

/-- P12: A disabled forbidden_path guard always allows. -/
theorem disabled_forbidden_path_allows (cfg : ForbiddenPathConfig)
    (action : Action) (ctx : Context)
    (h_disabled : cfg.enabled = false) :
    (evalForbiddenPath cfg action ctx).allowed = true := by
  unfold evalForbiddenPath
  simp [h_disabled, GuardResult.allow]

/-- P12a: A disabled egress_allowlist guard always allows. -/
theorem disabled_egress_allows (cfg : EgressAllowlistConfig)
    (action : Action) (ctx : Context)
    (h_disabled : cfg.enabled = false) :
    (evalEgressAllowlist cfg action ctx).allowed = true := by
  unfold evalEgressAllowlist
  simp [h_disabled, GuardResult.allow]

/-- P12b: A disabled shell_command guard always allows. -/
theorem disabled_shell_command_allows (cfg : ShellCommandConfig)
    (action : Action) (ctx : Context)
    (h_disabled : cfg.enabled = false) :
    (evalShellCommand cfg action ctx).allowed = true := by
  unfold evalShellCommand
  simp [h_disabled, GuardResult.allow]

/-- P12c: A disabled mcp_tool guard always allows. -/
theorem disabled_mcp_tool_allows (cfg : McpToolConfig)
    (action : Action) (ctx : Context)
    (h_disabled : cfg.enabled = false) :
    (evalMcpTool cfg action ctx).allowed = true := by
  unfold evalMcpTool
  simp [h_disabled, GuardResult.allow]

-- ============================================================================
-- P13: Action Irrelevance
--
-- A guard only inspects actions relevant to its domain. Non-matching
-- action types always pass through.
-- ============================================================================

/-- P13: ForbiddenPathGuard is irrelevant for non-path actions. -/
theorem forbidden_path_irrelevant_for_shell (cfg : ForbiddenPathConfig)
    (cmd : Command) (ctx : Context) :
    (evalForbiddenPath cfg (.shellCommand cmd) ctx).allowed = true := by
  unfold evalForbiddenPath
  cases h : cfg.enabled <;> simp [GuardResult.allow]

/-- P13a: EgressAllowlistGuard is irrelevant for non-egress actions. -/
theorem egress_irrelevant_for_file (cfg : EgressAllowlistConfig)
    (path : Path) (ctx : Context) :
    (evalEgressAllowlist cfg (.fileAccess path) ctx).allowed = true := by
  unfold evalEgressAllowlist
  cases h : cfg.enabled <;> simp [GuardResult.allow]

/-- P13b: ShellCommandGuard is irrelevant for non-shell actions. -/
theorem shell_irrelevant_for_file (cfg : ShellCommandConfig)
    (path : Path) (ctx : Context) :
    (evalShellCommand cfg (.fileAccess path) ctx).allowed = true := by
  unfold evalShellCommand
  cases h : cfg.enabled <;> simp [GuardResult.allow]

/-- P13c: McpToolGuard is irrelevant for non-MCP actions. -/
theorem mcp_irrelevant_for_file (cfg : McpToolConfig)
    (path : Path) (ctx : Context) :
    (evalMcpTool cfg (.fileAccess path) ctx).allowed = true := by
  unfold evalMcpTool
  cases h : cfg.enabled <;> simp [GuardResult.allow]

end ClawdStrike.Spec
