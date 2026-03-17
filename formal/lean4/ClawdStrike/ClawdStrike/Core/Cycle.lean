/-
  ClawdStrike Core: Cycle Detection

  The policy extension system uses `extends` fields to form a DAG of
  policy inheritance. Cycle detection ensures this graph is acyclic,
  preventing infinite loops during policy resolution.

  Key property (P6 Cycle Termination): Policy resolution with `extends`
  always terminates. The visited-set algorithm detects cycles and returns
  an error before re-entering a previously visited policy. The depth
  limit (MAX_POLICY_EXTENDS_DEPTH = 32) provides an additional hard bound.

  Rust source references:
    - `MAX_POLICY_EXTENDS_DEPTH`: crates/libs/clawdstrike/src/core/cycle.rs:10
    - `CycleCheckResult` enum: crates/libs/clawdstrike/src/core/cycle.rs:13-29
    - `check_extends_cycle` fn: crates/libs/clawdstrike/src/core/cycle.rs:37-56
    - Policy resolution: crates/libs/clawdstrike/src/policy.rs
      (uses `HashSet<String>` of visited policy keys)
-/

set_option autoImplicit false

namespace ClawdStrike.Core

/-- Maximum allowed depth for policy `extends` chains.
    Mirrors Rust `MAX_POLICY_EXTENDS_DEPTH` in core/cycle.rs:10. -/
def maxExtendsDepth : Nat := 32

-- ============================================================================
-- CycleCheckResult
-- ============================================================================

/-- Outcome of a cycle/depth check.
    Mirrors Rust `CycleCheckResult` in core/cycle.rs:13-29. -/
inductive CycleCheckResult where
  /-- The reference is safe to follow. -/
  | ok
  /-- The depth limit has been exceeded. -/
  | depthExceeded (depth : Nat) (limit : Nat)
  /-- A circular dependency was detected. -/
  | cycleDetected (key : String)
  deriving Repr, BEq

-- ============================================================================
-- check_extends_cycle
-- ============================================================================

/-- The visited set tracks which policy keys have been seen during resolution. -/
abbrev Visited := List String

/-- Check if a key is in the visited set. -/
def Visited.contains (visited : Visited) (key : String) : Bool :=
  visited.any (· == key)

/-- Check whether adding `key` at `depth` to the visited set is safe.
    Mirrors Rust `check_extends_cycle` in core/cycle.rs:37-56.

    Returns `CycleCheckResult.ok` if neither the depth limit nor a cycle
    is triggered. The caller is responsible for inserting `key` into `visited`
    after a successful check (this function does not mutate state).

    Note: Rust checks `depth > MAX_POLICY_EXTENDS_DEPTH` (strictly greater),
    so depth == maxExtendsDepth is still allowed. -/
def checkExtendsCycle (key : String) (visited : Visited) (depth : Nat) : CycleCheckResult :=
  if depth > maxExtendsDepth then
    .depthExceeded depth maxExtendsDepth
  else if visited.contains key then
    .cycleDetected key
  else
    .ok

-- ============================================================================
-- Policy Node and Chain Resolution
-- ============================================================================

/-- A policy node in the extends graph.
    `extends_` is `none` for leaf policies (no parent). -/
structure PolicyNode where
  key : String
  extends_ : Option String
  deriving Repr, BEq

/-- Result of policy chain resolution. -/
inductive ResolveResult where
  /-- Successfully resolved the chain; returns the ordered list of policy keys
      from leaf to root. -/
  | ok (chain : List String)
  /-- A cycle was detected at the given key. -/
  | cycleDetected (key : String)
  /-- Depth limit was exceeded. -/
  | depthExceeded (depth : Nat)
  deriving Repr

/-- Resolve a policy chain, detecting cycles via the visited set.
    This is a bounded recursion model: fuel limits the depth to ensure
    termination in the Lean model. The Rust version terminates because
    the visited set grows monotonically and the depth is bounded by
    MAX_POLICY_EXTENDS_DEPTH.

    Parameters:
    - `lookup`: maps a policy key to its PolicyNode (if it exists)
    - `key`: the current policy key to resolve
    - `visited`: keys already seen in this resolution path
    - `fuel`: recursion bound (decreases each step) -/
def resolveChain (lookup : String → Option PolicyNode) (key : String)
    (visited : Visited) (fuel : Nat) : ResolveResult :=
  match fuel with
  | 0 => .depthExceeded (visited.length)  -- Fuel exhausted
  | fuel' + 1 =>
    if visited.contains key then
      .cycleDetected key
    else
      match lookup key with
      | none => .ok (key :: visited)  -- Unknown key: treat as leaf
      | some node =>
        match node.extends_ with
        | none => .ok (key :: visited)  -- Leaf: no extends, success
        | some parent => resolveChain lookup parent (key :: visited) fuel'

/-- Resolve a chain using the standard fuel bound (maxExtendsDepth + 1).
    This provides enough fuel for the maximum allowed chain depth. -/
def resolveChainBounded (lookup : String → Option PolicyNode) (key : String) : ResolveResult :=
  resolveChain lookup key [] (maxExtendsDepth + 1)

end ClawdStrike.Core
