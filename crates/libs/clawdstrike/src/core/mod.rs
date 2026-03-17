//! Pure decision-making core (no I/O, no serde, no async).
//!
//! The existing `engine.rs` and `policy.rs` delegate to these functions,
//! keeping the original public API unchanged.

pub use hush_core::*;

pub mod aggregate;
pub mod cycle;
pub mod merge;
pub mod verdict;

pub use aggregate::{aggregate_index, aggregate_overall};
pub use cycle::{check_extends_cycle, CycleCheckResult, MAX_POLICY_EXTENDS_DEPTH};
pub use merge::{
    child_overrides, child_overrides_option, child_overrides_str, merge_keyed_vec,
    merge_keyed_vec_pure, CoreMergeStrategy,
};
pub use verdict::{severity_ord, CoreSeverity, CoreVerdict};
