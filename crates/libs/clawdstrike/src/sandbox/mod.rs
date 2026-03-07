//! Sandbox integration module.
//!
//! Translates ClawdStrike guard policies into nono `CapabilitySet` operations
//! for kernel-level enforcement.

pub mod capability_builder;
pub mod preflight;

pub use capability_builder::{CapabilityBuilder, TranslationWarning, WarningSeverity};
pub use preflight::{preflight_check, PreflightResult};
