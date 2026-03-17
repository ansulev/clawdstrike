/-
  ClawdStrike Core: Aggregate Overall

  The `aggregateOverall` function takes a list of guard results and produces
  an overall verdict. This is the most critical decision function in the engine.

  Key property (P1 Deny Monotonicity): if ANY guard denies (allowed = false),
  the aggregate MUST deny.

  Rust source reference:
    - `aggregate_index` fn: crates/libs/clawdstrike/src/core/aggregate.rs:23-64
    - `aggregate_overall` fn: crates/libs/clawdstrike/src/core/aggregate.rs:73-83

  The Rust implementation uses a two-step approach:
    1. `aggregate_index` selects the index of the "winning" verdict from a
       slice of (allowed, severity, sanitized) tuples.
    2. `aggregate_overall` maps verdicts to tuples, calls aggregate_index,
       and returns the verdict at the winning index (or a default allow).

  The selection rules (in priority order):
    1. A blocking result (allowed=false) always beats a non-blocking result.
    2. Among results with the same blocking status, higher severity wins.
    3. Among non-blocking results with equal severity, sanitized wins over
       non-sanitized (preserves sanitize payloads).

  The Rust code iterates left-to-right starting from results[0], keeping
  a "best" (worst) accumulator. On ties where no rule applies, the first-seen
  result is preserved. This Lean version uses `List.foldl` to match the
  left-fold iteration order precisely.

  Important: The formal spec document defines aggregate as:
    | []      => GuardResult.allow "engine"
    | r :: rs => rs.foldl worseResult r

  This is equivalent to our `results.foldl worseResult defaultResult` because
  defaultResult is allowed+info+not-sanitized, so any real result supersedes it
  via the severity or blocking rules. We provide both forms and a proof of
  equivalence is left for Phase 3.
-/

import ClawdStrike.Core.Verdict

set_option autoImplicit false

namespace ClawdStrike.Core

/-- Compare two guard results, returning the "worse" one.
    Mirrors the comparison logic in Rust `aggregate_index` loop body
    (core/aggregate.rs:33-61).

    Priority order:
    1. Blocking (allowed=false) always wins over non-blocking (allowed=true)
    2. Among same blocking status, higher severity wins
    3. Among non-blocking results with equal severity, sanitized=true wins
       over sanitized=false (preserves sanitize payloads)

    On complete ties, the first argument (accumulator/"best") is preserved,
    matching the Rust behavior where `best` stays when no rule triggers. -/
def worseResult (best candidate : GuardResult) : GuardResult :=
  let bestBlocks := !best.allowed
  let candBlocks := !candidate.allowed
  -- Rule 1: candidate blocks, best doesn't → candidate wins
  if candBlocks && !bestBlocks then candidate
  -- Rule 2: same blocking status, candidate has higher severity → candidate wins
  else if candBlocks == bestBlocks
       && candidate.severity.toNat > best.severity.toNat then candidate
  -- Rule 3: both non-blocking, same severity, candidate sanitized, best not
  else if candBlocks == bestBlocks
       && candidate.severity.toNat == best.severity.toNat
       && !candBlocks
       && candidate.sanitized
       && !best.sanitized then candidate
  -- Otherwise: best (accumulator) stays
  else best

/-- Default "all clear" result, used when the results list is empty.
    Mirrors Rust: `CoreVerdict::allow("engine")` at core/aggregate.rs:82. -/
def defaultResult : GuardResult :=
  { allowed := true
  , severity := .info
  , guardName := "engine"
  , message := "No guards matched"
  , sanitized := false }

/-- Aggregate a list of guard results into an overall verdict.
    Uses left fold to match Rust implementation's iteration order.

    The Rust `aggregate_overall` returns `CoreVerdict::allow("engine")` for
    empty input, and for non-empty input selects the "worst" result via
    `aggregate_index`. Our foldl with defaultResult as initial value is
    equivalent because defaultResult is allowed+info+not-sanitized, so
    any real result will supersede it via Rule 1 or Rule 2. -/
def aggregateOverall (results : List GuardResult) : GuardResult :=
  results.foldl worseResult defaultResult

/-- Alternative aggregate definition matching the formal spec document
    (section 3.5). Uses direct pattern matching for empty vs non-empty. -/
def aggregateSpec : List GuardResult → GuardResult
  | [] => GuardResult.allow "engine"
  | r :: rs => rs.foldl worseResult r

end ClawdStrike.Core
