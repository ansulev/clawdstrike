//! Differential testing framework for ClawdStrike's core decision logic.
//!
//! This crate compares the production implementation (`clawdstrike::core`)
//! against an independent reference specification (`spec`) using property-based
//! testing (proptest). The approach follows Amazon Cedar's methodology of
//! running millions of randomized inputs through both implementations and
//! asserting equivalence.
//!
//! # Modules
//!
//! - [`spec`] — Reference specification (independent reimplementation)
//! - [`generators`] — Proptest strategies for generating random inputs
//! - [`harness`] — Diff-test result tracking and comparison utilities

pub mod generators;
pub mod harness;
pub mod spec;
