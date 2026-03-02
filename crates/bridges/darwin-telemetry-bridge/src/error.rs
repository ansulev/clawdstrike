//! Error types for the darwin-telemetry-bridge crate.

use thiserror::Error;

/// Errors that can occur during bridge operations.
#[non_exhaustive]
#[derive(Error, Debug)]
pub enum Error {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("process collector error: {0}")]
    Process(String),

    #[error("FSEvents error: {0}")]
    FsEvents(String),

    #[error("unified log error: {0}")]
    UnifiedLog(String),

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

    #[error("channel send error: {0}")]
    Channel(String),
}

/// Result type for bridge operations.
pub type Result<T> = std::result::Result<T, Error>;
