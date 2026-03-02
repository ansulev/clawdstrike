//! Error types for the auditd-bridge crate.

use thiserror::Error;

/// Errors that can occur during bridge operations.
#[non_exhaustive]
#[derive(Error, Debug)]
pub enum Error {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("parse error: {0}")]
    Parse(String),

    #[error("NATS error: {0}")]
    Nats(String),

    #[error("spine error: {0}")]
    Spine(#[from] spine::Error),

    #[error("signing error: {0}")]
    Signing(#[from] hush_core::Error),

    #[error("serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("configuration error: {0}")]
    Config(String),
}

/// Result type for bridge operations.
pub type Result<T> = std::result::Result<T, Error>;
