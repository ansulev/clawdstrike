//! Proptest generators for differential testing.
//!
//! Generates random inputs that can be fed to both the reference specification
//! and the production implementation for comparison.

use proptest::prelude::*;
use std::collections::HashSet;

use crate::spec::SpecSeverity;
use crate::spec::SpecVerdict;

// ---------------------------------------------------------------------------
// Severity generators
// ---------------------------------------------------------------------------

/// Generate a random `SpecSeverity`.
pub fn arb_spec_severity() -> impl Strategy<Value = SpecSeverity> {
    prop_oneof![
        Just(SpecSeverity::Info),
        Just(SpecSeverity::Warning),
        Just(SpecSeverity::Error),
        Just(SpecSeverity::Critical),
    ]
}

/// Generate a random `CoreSeverity` (production type).
pub fn arb_core_severity() -> impl Strategy<Value = clawdstrike::core::CoreSeverity> {
    prop_oneof![
        Just(clawdstrike::core::CoreSeverity::Info),
        Just(clawdstrike::core::CoreSeverity::Warning),
        Just(clawdstrike::core::CoreSeverity::Error),
        Just(clawdstrike::core::CoreSeverity::Critical),
    ]
}

// ---------------------------------------------------------------------------
// Verdict generators
// ---------------------------------------------------------------------------

/// Generate a random `SpecVerdict`.
pub fn arb_spec_verdict() -> impl Strategy<Value = SpecVerdict> {
    (
        any::<bool>(),
        arb_spec_severity(),
        any::<bool>(),
        "[a-z]{1,10}",
    )
        .prop_map(|(allowed, severity, sanitized, guard)| SpecVerdict {
            allowed,
            severity,
            sanitized,
            guard,
            message: String::new(),
        })
}

/// Generate a random `CoreVerdict` (production type).
pub fn arb_core_verdict() -> impl Strategy<Value = clawdstrike::core::CoreVerdict> {
    (
        any::<bool>(),
        arb_core_severity(),
        any::<bool>(),
        "[a-z]{1,10}",
    )
        .prop_map(
            |(allowed, severity, sanitized, guard)| clawdstrike::core::CoreVerdict {
                allowed,
                severity,
                sanitized,
                guard,
                message: String::new(),
            },
        )
}

/// Generate a paired (spec, impl) verdict from the same random seed.
///
/// This ensures both sides see identical inputs for differential comparison.
pub fn arb_paired_verdict(
) -> impl Strategy<Value = (SpecVerdict, clawdstrike::core::CoreVerdict)> {
    (
        any::<bool>(),
        0u8..4,
        any::<bool>(),
        "[a-z]{1,10}",
    )
        .prop_map(|(allowed, sev_idx, sanitized, guard)| {
            let spec_sev = match sev_idx {
                0 => SpecSeverity::Info,
                1 => SpecSeverity::Warning,
                2 => SpecSeverity::Error,
                _ => SpecSeverity::Critical,
            };
            let core_sev = match sev_idx {
                0 => clawdstrike::core::CoreSeverity::Info,
                1 => clawdstrike::core::CoreSeverity::Warning,
                2 => clawdstrike::core::CoreSeverity::Error,
                _ => clawdstrike::core::CoreSeverity::Critical,
            };

            let spec = SpecVerdict {
                allowed,
                severity: spec_sev,
                sanitized,
                guard: guard.clone(),
                message: String::new(),
            };
            let core = clawdstrike::core::CoreVerdict {
                allowed,
                severity: core_sev,
                sanitized,
                guard,
                message: String::new(),
            };
            (spec, core)
        })
}

/// Generate a paired list of verdicts (1..50 items).
pub fn arb_paired_verdicts(
) -> impl Strategy<Value = (Vec<SpecVerdict>, Vec<clawdstrike::core::CoreVerdict>)> {
    prop::collection::vec(arb_paired_verdict(), 1..50).prop_map(|pairs| {
        let (specs, cores): (Vec<_>, Vec<_>) = pairs.into_iter().unzip();
        (specs, cores)
    })
}

// ---------------------------------------------------------------------------
// Merge generators
// ---------------------------------------------------------------------------

/// An optional value for merge testing.
pub fn arb_option_i32() -> impl Strategy<Value = Option<i32>> {
    prop_oneof![Just(None), any::<i32>().prop_map(Some)]
}

/// Generate a pair of optional values for child-overrides testing.
pub fn arb_option_pair() -> impl Strategy<Value = (Option<i32>, Option<i32>)> {
    (arb_option_i32(), arb_option_i32())
}

/// Generate a pair of strings for child-overrides-str testing.
pub fn arb_str_pair() -> impl Strategy<Value = (String, String)> {
    (
        prop_oneof![Just(String::new()), "[a-z]{1,10}".prop_map(String::from)],
        prop_oneof![Just(String::new()), "[a-z]{1,10}".prop_map(String::from)],
    )
}

/// A keyed item for merge_keyed_vec testing.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KeyedItem {
    pub key: u8,
    pub value: String,
}

/// Generate a random keyed item.
pub fn arb_keyed_item() -> impl Strategy<Value = KeyedItem> {
    (0u8..20, "[a-z]{1,5}").prop_map(|(key, value)| KeyedItem { key, value })
}

/// Generate a pair of keyed-item vectors for merge testing.
/// NOTE: base and child may contain duplicate keys (matching production usage).
pub fn arb_keyed_vec_pair() -> impl Strategy<Value = (Vec<KeyedItem>, Vec<KeyedItem>)> {
    (
        prop::collection::vec(arb_keyed_item(), 0..15),
        prop::collection::vec(arb_keyed_item(), 0..15),
    )
}

/// Generate a pair of keyed-item vectors with unique keys within each vector.
/// This is useful for property tests that assume no duplicate keys in the base.
pub fn arb_unique_keyed_vec_pair() -> impl Strategy<Value = (Vec<KeyedItem>, Vec<KeyedItem>)> {
    arb_keyed_vec_pair().prop_map(|(base, child)| {
        // Deduplicate: keep last occurrence per key (same HashMap semantics).
        fn dedup(items: Vec<KeyedItem>) -> Vec<KeyedItem> {
            let mut seen = std::collections::HashMap::new();
            let mut out = Vec::new();
            for item in items {
                if let Some(idx) = seen.get(&item.key).copied() {
                    out[idx] = item.clone();
                } else {
                    seen.insert(item.key, out.len());
                    out.push(item);
                }
            }
            out
        }
        (dedup(base), dedup(child))
    })
}

// ---------------------------------------------------------------------------
// Cycle detection generators
// ---------------------------------------------------------------------------

/// Generate a random key for cycle detection testing.
pub fn arb_key() -> impl Strategy<Value = String> {
    "[a-z]{1,8}\\.yaml"
}

/// Generate a random visited set (0..10 keys).
pub fn arb_visited_set() -> impl Strategy<Value = HashSet<String>> {
    prop::collection::hash_set(arb_key(), 0..10)
}

/// Generate a random depth value (0..40, so it can exceed the limit of 32).
pub fn arb_depth() -> impl Strategy<Value = usize> {
    0usize..40
}

/// Generate a complete cycle-detection scenario.
pub fn arb_cycle_scenario() -> impl Strategy<Value = (String, HashSet<String>, usize)> {
    (arb_key(), arb_visited_set(), arb_depth())
}

/// Generate a cycle-detection scenario where the key IS in the visited set
/// (to ensure cycle detection fires reliably).
pub fn arb_cycle_present_scenario() -> impl Strategy<Value = (String, HashSet<String>, usize)> {
    arb_visited_set()
        .prop_filter("need at least one key", |s| !s.is_empty())
        .prop_flat_map(|set| {
            let keys: Vec<String> = set.iter().cloned().collect();
            (
                prop::sample::select(keys),
                Just(set),
                0usize..=32, // depth within limit so cycle is the trigger
            )
        })
}
