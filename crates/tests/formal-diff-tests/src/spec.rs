//! Reference specification — an independent, obviously-correct reimplementation
//! of the core decision logic.
//!
//! This module mirrors the Lean formal specification. Every function is written
//! for *clarity* over performance. It does **not** call into the production
//! `clawdstrike::core` module — it is a completely separate implementation.

use std::collections::{HashMap, HashSet};

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

/// Severity levels, matching `CoreSeverity`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SpecSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

/// Total ordering on severity: Info < Warning < Error < Critical.
#[must_use]
pub fn severity_ord_spec(s: SpecSeverity) -> u8 {
    match s {
        SpecSeverity::Info => 0,
        SpecSeverity::Warning => 1,
        SpecSeverity::Error => 2,
        SpecSeverity::Critical => 3,
    }
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

/// Minimal verdict, matching `CoreVerdict`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SpecVerdict {
    pub allowed: bool,
    pub severity: SpecSeverity,
    pub sanitized: bool,
    pub guard: String,
    pub message: String,
}

impl SpecVerdict {
    /// Default "allow" verdict (used when no results exist).
    #[must_use]
    pub fn default_allow() -> Self {
        Self {
            allowed: true,
            severity: SpecSeverity::Info,
            sanitized: false,
            guard: "engine".to_string(),
            message: "Allowed".to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// Worse-result comparator
// ---------------------------------------------------------------------------

/// Determine whether `candidate` should replace `current_best` as the
/// "winning" (worst) verdict.
///
/// Rules (in priority order):
/// 1. A blocking result always beats a non-blocking result.
/// 2. Among results with the same blocking status, higher severity wins.
/// 3. Among *allowed* results with equal severity, sanitized beats plain.
///
/// Returns `true` if `candidate` is strictly worse than `current_best`.
#[must_use]
pub fn is_worse_spec(current_best: &SpecVerdict, candidate: &SpecVerdict) -> bool {
    let best_blocks = !current_best.allowed;
    let cand_blocks = !candidate.allowed;

    // Rule 1: blocking beats non-blocking
    if cand_blocks && !best_blocks {
        return true;
    }
    // If best blocks but candidate does not, candidate cannot be worse.
    if best_blocks && !cand_blocks {
        return false;
    }

    // Same blocking status — compare severity.
    let best_sev = severity_ord_spec(current_best.severity);
    let cand_sev = severity_ord_spec(candidate.severity);

    // Rule 2: higher severity wins
    if cand_sev > best_sev {
        return true;
    }
    if cand_sev < best_sev {
        return false;
    }

    // Same blocking status AND same severity.
    // Rule 3: among allowed results, sanitized wins over plain.
    // (This rule does NOT apply to blocked results.)
    if !cand_blocks && candidate.sanitized && !current_best.sanitized {
        return true;
    }

    false
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/// Aggregate a slice of verdicts into a single overall verdict.
///
/// Selection: iterate left-to-right, keeping the "worst" verdict according
/// to `is_worse_spec`. On a complete tie the first element wins (stability).
///
/// Empty input returns `SpecVerdict::default_allow()`.
#[must_use]
pub fn aggregate_spec(results: &[SpecVerdict]) -> SpecVerdict {
    if results.is_empty() {
        return SpecVerdict::default_allow();
    }

    let mut best = &results[0];

    for candidate in results.iter().skip(1) {
        if is_worse_spec(best, candidate) {
            best = candidate;
        }
    }

    best.clone()
}

// ---------------------------------------------------------------------------
// Merge combinators
// ---------------------------------------------------------------------------

/// Child-overrides-base for `Option<T>`.
#[must_use]
pub fn child_overrides_spec<T: Clone>(base: &Option<T>, child: &Option<T>) -> Option<T> {
    match child {
        Some(v) => Some(v.clone()),
        None => base.clone(),
    }
}

/// Child-overrides-base for non-empty strings.
#[must_use]
pub fn child_overrides_str_spec(base: &str, child: &str) -> String {
    if child.is_empty() {
        base.to_string()
    } else {
        child.to_string()
    }
}

/// Merge two keyed vectors: child entries replace base entries with the same key,
/// new entries are appended. Empty child returns base; empty base returns child.
pub fn merge_keyed_vec_spec<T: Clone, K: Eq + std::hash::Hash>(
    base: &[T],
    child: &[T],
    key_fn: impl Fn(&T) -> K,
) -> Vec<T> {
    if child.is_empty() {
        return base.to_vec();
    }
    if base.is_empty() {
        return child.to_vec();
    }

    // Start with a copy of base.
    let mut out: Vec<T> = Vec::with_capacity(base.len() + child.len());
    let mut key_to_idx: HashMap<K, usize> = HashMap::new();

    for item in base {
        let k = key_fn(item);
        let idx = out.len();
        key_to_idx.insert(k, idx);
        out.push(item.clone());
    }

    // For each child entry: replace if key exists, else append.
    for item in child {
        let k = key_fn(item);
        if let Some(&idx) = key_to_idx.get(&k) {
            out[idx] = item.clone();
        } else {
            let idx = out.len();
            key_to_idx.insert(k, idx);
            out.push(item.clone());
        }
    }

    out
}

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

/// Maximum extends depth (must match production constant).
pub const MAX_DEPTH_SPEC: usize = 32;

/// Outcome of cycle/depth check.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CycleCheckSpec {
    Ok,
    DepthExceeded { depth: usize, limit: usize },
    CycleDetected { key: String },
}

/// Check whether adding `key` at `depth` to the visited set would be safe.
///
/// - If `depth > MAX_DEPTH_SPEC`, returns `DepthExceeded`.
/// - If `key` is already in `visited`, returns `CycleDetected`.
/// - Otherwise returns `Ok`.
#[must_use]
pub fn check_extends_cycle_spec(
    key: &str,
    visited: &HashSet<String>,
    depth: usize,
) -> CycleCheckSpec {
    if depth > MAX_DEPTH_SPEC {
        return CycleCheckSpec::DepthExceeded {
            depth,
            limit: MAX_DEPTH_SPEC,
        };
    }

    if visited.contains(key) {
        return CycleCheckSpec::CycleDetected {
            key: key.to_string(),
        };
    }

    CycleCheckSpec::Ok
}

// ---------------------------------------------------------------------------
// Unit tests for the spec itself (sanity checks)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn severity_ordering_is_total_and_strict() {
        let all = [
            SpecSeverity::Info,
            SpecSeverity::Warning,
            SpecSeverity::Error,
            SpecSeverity::Critical,
        ];
        for (i, a) in all.iter().enumerate() {
            for (j, b) in all.iter().enumerate() {
                if i < j {
                    assert!(severity_ord_spec(*a) < severity_ord_spec(*b));
                } else if i == j {
                    assert_eq!(severity_ord_spec(*a), severity_ord_spec(*b));
                } else {
                    assert!(severity_ord_spec(*a) > severity_ord_spec(*b));
                }
            }
        }
    }

    #[test]
    fn aggregate_empty_is_allow() {
        let result = aggregate_spec(&[]);
        assert!(result.allowed);
        assert_eq!(result.severity, SpecSeverity::Info);
        assert!(!result.sanitized);
        assert_eq!(result.guard, "engine");
    }

    #[test]
    fn aggregate_single_block() {
        let v = SpecVerdict {
            allowed: false,
            severity: SpecSeverity::Error,
            sanitized: false,
            guard: "g1".into(),
            message: String::new(),
        };
        let result = aggregate_spec(std::slice::from_ref(&v));
        assert_eq!(result, v);
    }

    #[test]
    fn block_beats_allow() {
        let allow = SpecVerdict {
            allowed: true,
            severity: SpecSeverity::Info,
            sanitized: false,
            guard: "g1".into(),
            message: String::new(),
        };
        let block = SpecVerdict {
            allowed: false,
            severity: SpecSeverity::Error,
            sanitized: false,
            guard: "g2".into(),
            message: String::new(),
        };
        let result = aggregate_spec(&[allow, block]);
        assert!(!result.allowed);
        assert_eq!(result.guard, "g2");
    }

    #[test]
    fn higher_severity_wins_among_blocks() {
        let low = SpecVerdict {
            allowed: false,
            severity: SpecSeverity::Warning,
            sanitized: false,
            guard: "g1".into(),
            message: String::new(),
        };
        let high = SpecVerdict {
            allowed: false,
            severity: SpecSeverity::Critical,
            sanitized: false,
            guard: "g2".into(),
            message: String::new(),
        };
        let result = aggregate_spec(&[low, high]);
        assert_eq!(result.guard, "g2");
    }

    #[test]
    fn sanitize_preferred_among_allows_at_same_severity() {
        let plain = SpecVerdict {
            allowed: true,
            severity: SpecSeverity::Warning,
            sanitized: false,
            guard: "g1".into(),
            message: String::new(),
        };
        let sanitized = SpecVerdict {
            allowed: true,
            severity: SpecSeverity::Warning,
            sanitized: true,
            guard: "g2".into(),
            message: String::new(),
        };
        let result = aggregate_spec(&[plain, sanitized]);
        assert!(result.sanitized);
        assert_eq!(result.guard, "g2");
    }

    #[test]
    fn first_wins_on_complete_tie() {
        let a = SpecVerdict {
            allowed: true,
            severity: SpecSeverity::Info,
            sanitized: false,
            guard: "first".into(),
            message: String::new(),
        };
        let b = SpecVerdict {
            allowed: true,
            severity: SpecSeverity::Info,
            sanitized: false,
            guard: "second".into(),
            message: String::new(),
        };
        let result = aggregate_spec(&[a, b]);
        assert_eq!(result.guard, "first");
    }

    #[test]
    fn cycle_detection_basics() {
        let empty: HashSet<String> = HashSet::new();
        assert_eq!(
            check_extends_cycle_spec("a.yaml", &empty, 0),
            CycleCheckSpec::Ok
        );

        let mut visited = HashSet::new();
        visited.insert("a.yaml".to_string());
        assert_eq!(
            check_extends_cycle_spec("a.yaml", &visited, 1),
            CycleCheckSpec::CycleDetected {
                key: "a.yaml".to_string()
            }
        );

        assert_eq!(
            check_extends_cycle_spec("b.yaml", &empty, MAX_DEPTH_SPEC + 1),
            CycleCheckSpec::DepthExceeded {
                depth: MAX_DEPTH_SPEC + 1,
                limit: MAX_DEPTH_SPEC,
            }
        );
    }
}
