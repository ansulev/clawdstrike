/-
  ClawdStrike Proofs: Cycle Termination (P10, P10a, P10b, P10c)

  This file contains the proofs of cycle detection and termination
  properties for the policy `extends` resolution system.

  Properties proven:
  - P10:  If a key is already visited, checkExtendsCycle detects the cycle.
  - P10a: If a key is already visited, resolveChain detects the cycle.
  - P10b: resolveChain with zero fuel terminates (with depthExceeded).
  - P10c: Depth exceeding the limit is detected by checkExtendsCycle.
  - Additional: visited set grows monotonically through resolution.
  - Additional: fuel monotonicity (success with n implies success with n+1).

  Rust reference: check_extends_cycle at core/cycle.rs
  Uses HashSet<String> for visited; checks visited.contains(key) before
  recursing. Depth exceeding MAX_POLICY_EXTENDS_DEPTH (32) returns
  DepthExceeded. Cycle detected returns CycleDetected.

  Lean model: Core/Cycle.lean
  - checkExtendsCycle checks depth > maxExtendsDepth, then visited.contains
  - resolveChain uses fuel-bounded recursion (fuel=0 → depthExceeded)
  - Visited is a List String with linear search via .any
-/

import ClawdStrike.Core.Cycle
import ClawdStrike.Spec.Properties

set_option autoImplicit false

namespace ClawdStrike.Proofs

open ClawdStrike.Core

-- ============================================================================
-- P10c: Depth exceeding the limit is detected by checkExtendsCycle
--
-- If depth > maxExtendsDepth, checkExtendsCycle returns depthExceeded.
--
-- Proof: unfold checkExtendsCycle, the first if-condition fires.
-- ============================================================================

theorem depth_exceeded_detected (key : String) (visited : Visited) (depth : Nat)
    (h_deep : depth > maxExtendsDepth) :
    checkExtendsCycle key visited depth = .depthExceeded depth maxExtendsDepth := by
  unfold checkExtendsCycle
  simp [h_deep]

-- ============================================================================
-- P10: If a key is already visited and depth is within limit,
-- checkExtendsCycle detects the cycle.
--
-- Proof: unfold checkExtendsCycle. The depth check passes (h_depth ensures
-- depth <= maxExtendsDepth so !(depth > maxExtendsDepth)). Then the
-- visited.contains check fires.
-- ============================================================================

theorem cycle_detected_if_visited_check (key : String) (visited : Visited) (depth : Nat)
    (h_visited : visited.contains key = true)
    (h_depth : depth ≤ maxExtendsDepth) :
    checkExtendsCycle key visited depth = .cycleDetected key := by
  unfold checkExtendsCycle
  -- depth > maxExtendsDepth is false (since depth ≤ maxExtendsDepth)
  have h_not_deep : ¬(depth > maxExtendsDepth) := Nat.not_lt_of_le h_depth
  simp [Nat.not_lt.mpr h_depth, h_visited]

-- ============================================================================
-- checkExtendsCycle returns .ok only when not deep and not visited
-- ============================================================================

theorem check_extends_ok (key : String) (visited : Visited) (depth : Nat)
    (h_not_deep : depth ≤ maxExtendsDepth)
    (h_not_visited : visited.contains key = false) :
    checkExtendsCycle key visited depth = .ok := by
  unfold checkExtendsCycle
  simp [Nat.not_lt.mpr h_not_deep, h_not_visited]

-- ============================================================================
-- P10b: resolveChain with zero fuel terminates with depthExceeded
--
-- resolveChain lookup key visited 0 = .depthExceeded (visited.length)
-- ============================================================================

theorem zero_fuel_terminates (lookup : String → Option PolicyNode)
    (key : String) (visited : Visited) :
    ∃ n, resolveChain lookup key visited 0 = .depthExceeded n := by
  exact ⟨visited.length, rfl⟩

-- ============================================================================
-- P10a: If a key is already visited, resolveChain detects the cycle
-- (for any nonzero fuel).
--
-- resolveChain lookup key visited (fuel + 1) = .cycleDetected key
-- when visited.contains key = true
-- ============================================================================

theorem resolveChain_cycle_detected (lookup : String → Option PolicyNode)
    (key : String) (visited : Visited) (fuel : Nat)
    (h_visited : visited.contains key = true)
    (h_fuel : fuel > 0) :
    ∃ k, resolveChain lookup key visited fuel = .cycleDetected k := by
  -- fuel > 0 means fuel = n + 1 for some n
  match fuel, h_fuel with
  | n + 1, _ =>
    exists key
    unfold resolveChain
    simp [h_visited]

-- ============================================================================
-- Corollary: resolveChain with any fuel detects a visited key
-- (either via cycleDetected or depthExceeded).
-- ============================================================================

theorem resolve_terminates_on_visited (lookup : String → Option PolicyNode)
    (key : String) (visited : Visited) (fuel : Nat)
    (h_visited : visited.contains key = true) :
    (∃ k, resolveChain lookup key visited fuel = .cycleDetected k) ∨
    (∃ n, resolveChain lookup key visited fuel = .depthExceeded n) := by
  cases fuel with
  | zero =>
    right
    exact zero_fuel_terminates lookup key visited
  | succ n =>
    left
    exact resolveChain_cycle_detected lookup key visited (n + 1) h_visited (Nat.succ_pos n)

-- ============================================================================
-- Visited set growth: if resolveChain returns .ok chain, then
-- every key in visited is also in chain.
--
-- This shows that the visited set only grows during resolution.
-- ============================================================================

theorem resolve_ok_extends_visited (lookup : String → Option PolicyNode)
    (key : String) (visited : Visited) (fuel : Nat) (chain : List String)
    (h_ok : resolveChain lookup key visited fuel = .ok chain)
    (k : String) (h_in : k ∈ visited) :
    k ∈ chain := by
  induction fuel generalizing key visited with
  | zero =>
    -- fuel = 0: resolveChain returns .depthExceeded, not .ok — contradiction
    unfold resolveChain at h_ok
    simp at h_ok
  | succ n ih =>
    unfold resolveChain at h_ok
    split at h_ok
    · -- visited.contains key = true → .cycleDetected, contradiction with .ok
      simp at h_ok
    · -- visited.contains key = false
      split at h_ok
      · -- lookup key = none → .ok (key :: visited), so chain = key :: visited
        simp [ResolveResult.ok.injEq] at h_ok
        rw [← h_ok]
        exact List.mem_cons_of_mem key h_in
      · -- lookup key = some node
        split at h_ok
        · -- node.extends_ = none → .ok (key :: visited)
          simp [ResolveResult.ok.injEq] at h_ok
          rw [← h_ok]
          exact List.mem_cons_of_mem key h_in
        · -- node.extends_ = some parent → recurse with key :: visited
          rename_i _ _ heq
          have h_mem : k ∈ key :: visited := List.mem_cons_of_mem key h_in
          exact ih _ (key :: visited) h_ok h_mem

-- ============================================================================
-- The key itself appears in the chain on success
-- ============================================================================

theorem resolve_ok_contains_key (lookup : String → Option PolicyNode)
    (key : String) (visited : Visited) (fuel : Nat) (chain : List String)
    (h_ok : resolveChain lookup key visited fuel = .ok chain) :
    key ∈ chain := by
  induction fuel generalizing key visited with
  | zero =>
    unfold resolveChain at h_ok
    simp at h_ok
  | succ n ih =>
    unfold resolveChain at h_ok
    split at h_ok
    · simp at h_ok
    · split at h_ok
      · -- leaf (lookup = none): chain = key :: visited
        simp [ResolveResult.ok.injEq] at h_ok
        rw [← h_ok]
        exact List.mem_cons_self ..
      · split at h_ok
        · -- leaf (no extends): chain = key :: visited
          simp [ResolveResult.ok.injEq] at h_ok
          rw [← h_ok]
          exact List.mem_cons_self ..
        · -- recurse: visited becomes key :: visited
          exact resolve_ok_extends_visited lookup _ (key :: visited) n chain h_ok
            key (List.mem_cons_self ..)

-- ============================================================================
-- Fuel monotonicity: if resolveChain succeeds with fuel n,
-- it also succeeds with fuel n+1.
-- ============================================================================

theorem resolve_fuel_mono (lookup : String → Option PolicyNode)
    (key : String) (visited : Visited) (n : Nat) (chain : List String)
    (h_ok : resolveChain lookup key visited n = .ok chain) :
    resolveChain lookup key visited (n + 1) = .ok chain := by
  induction n generalizing key visited with
  | zero =>
    -- fuel = 0: returns .depthExceeded, not .ok — contradiction
    unfold resolveChain at h_ok
    simp at h_ok
  | succ m ih =>
    -- The key insight: resolveChain (succ (succ m)) and resolveChain (succ m)
    -- have the same structure after one unfolding step.
    -- We unfold at h_ok (fuel = succ m) and in the goal (fuel = succ (succ m)).
    -- After the first match on fuel (which is succ _ in both), the logic is identical.
    unfold resolveChain at h_ok ⊢
    -- Both have: if visited.contains key then ... else ...
    -- We do case analysis on the shared boolean condition
    cases h_vis : Visited.contains visited key
    · -- visited.contains key = false: proceed
      simp [h_vis] at h_ok ⊢
      -- Now split on lookup key
      cases h_look : lookup key
      · -- lookup key = none → both return .ok (key :: visited)
        simp [h_look] at h_ok ⊢
        exact h_ok
      · -- lookup key = some node
        simp [h_look] at h_ok ⊢
        rename_i node
        -- Split on node.extends_
        cases h_ext : node.extends_
        · -- extends_ = none → both return .ok (key :: visited)
          simp [h_ext] at h_ok ⊢
          exact h_ok
        · -- extends_ = some parent → both recurse with key :: visited
          simp [h_ext] at h_ok ⊢
          exact ih _ (key :: visited) h_ok
    · -- visited.contains key = true → both return .cycleDetected, contradicts h_ok
      simp [h_vis] at h_ok

end ClawdStrike.Proofs
