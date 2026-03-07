//! Sandbox integration module.
//!
//! Translates ClawdStrike guard policies into nono `CapabilitySet` operations
//! for kernel-level enforcement.

pub mod capability_builder;

pub use capability_builder::{CapabilityBuilder, TranslationWarning, WarningSeverity};
