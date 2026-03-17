//! Pure, safe, no-async, no-serde decision-making core.
//!
//! This module contains the formal-verification-friendly subset of Clawdstrike's
//! decision logic. Every function here is:
//!
//! - **Pure**: no I/O, no network, no filesystem access
//! - **Safe**: no `unsafe` blocks
//! - **Synchronous**: no `async`, no `tokio`
//! - **Self-contained**: no `serde`, no `dyn Trait`, no `Arc`/`Mutex`/`RwLock`
//!
//! The existing `engine.rs` and `policy.rs` delegate to these functions,
//! keeping the original public API unchanged.
//!
//! # Modules
//!
//! - [`verdict`] — Core severity enum and verdict types
//! - [`aggregate`] — Verdict aggregation logic
//! - [`cycle`] — Policy extends cycle/depth detection
//! - [`merge`] — Generic merge combinators for policy composition

pub mod aggregate;
pub mod cycle;
pub mod merge;
pub mod verdict;

// Re-export key types at the `core` level for convenience.
pub use aggregate::{aggregate_index, aggregate_overall};
pub use cycle::{check_extends_cycle, CycleCheckResult, MAX_POLICY_EXTENDS_DEPTH};
pub use merge::{
    child_overrides, child_overrides_option, child_overrides_str, merge_keyed_vec,
    merge_keyed_vec_pure, CoreMergeStrategy,
};
pub use verdict::{severity_ord, CoreSeverity, CoreVerdict};
