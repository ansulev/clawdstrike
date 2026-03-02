#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

//! # auditd-bridge
//!
//! Tails the Linux auditd log and publishes runtime audit events as signed
//! Spine envelopes to NATS JetStream.
//!
//! ## Architecture
//!
//! ```text
//! /var/log/audit/audit.log ─► AuditLogTailer ─► AuditEventGrouper ─► mapper ─► Spine envelope ─► NATS
//! ```
//!
//! The bridge:
//! 1. Tails the audit log file with rotation detection
//! 2. Parses each line and groups multi-line records by serial number
//! 3. Maps grouped events to Spine facts via [`mapper`]
//! 4. Signs the fact into a [`spine::envelope`] using an Ed25519 keypair
//! 5. Publishes to NATS subject `clawdstrike.spine.envelope.auditd.{event_type}.v1`
//!
//! Filtering is configurable: event types can be included/excluded.

pub mod audit;
pub mod error;
pub mod mapper;

use std::sync::Mutex;
use std::time::Duration;

use hush_core::Keypair;
use tracing::{debug, info, warn};

use crate::audit::{parse_audit_line, AuditEvent, AuditEventGrouper, AuditEventType, AuditLogTailer};
use crate::error::{Error, Result};
use crate::mapper::map_event;

/// NATS subject prefix for all auditd bridge envelopes.
const NATS_SUBJECT_PREFIX: &str = "clawdstrike.spine.envelope.auditd";

/// NATS JetStream stream name.
const STREAM_NAME: &str = "CLAWDSTRIKE_AUDITD";

/// Configuration for the bridge.
#[derive(Debug, Clone)]
pub struct BridgeConfig {
    /// Path to the audit log file (e.g. `/var/log/audit/audit.log`).
    pub audit_log_path: String,
    /// NATS server URL (e.g. `nats://localhost:4222`).
    pub nats_url: String,
    /// Hex-encoded Ed25519 seed for signing envelopes.
    /// If empty, a random keypair is generated.
    pub signing_key_hex: Option<String>,
    /// Event types to forward. If empty, all event types are forwarded.
    pub event_type_filter: Vec<AuditEventType>,
    /// Timeout in milliseconds for grouping multi-line audit records.
    pub group_timeout_ms: u64,
    /// Poll interval in milliseconds for tailing the audit log file.
    pub poll_interval_ms: u64,
    /// Number of JetStream replicas for the stream.
    pub stream_replicas: usize,
    /// Maximum bytes retained in the JetStream stream (0 = unlimited).
    pub stream_max_bytes: i64,
    /// Maximum age retained in the JetStream stream in seconds (0 = unlimited).
    pub stream_max_age_seconds: u64,
    /// Maximum consecutive handle_event errors before run() returns an error.
    pub max_consecutive_errors: u64,
    /// Path to SPIFFE SVID PEM file. When set, the bridge reads the workload
    /// SPIFFE ID and includes it in every published fact.
    pub svid_path: Option<String>,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            audit_log_path: "/var/log/audit/audit.log".to_string(),
            nats_url: "nats://localhost:4222".to_string(),
            signing_key_hex: None,
            event_type_filter: Vec::new(),
            group_timeout_ms: 500,
            poll_interval_ms: 250,
            stream_replicas: 1,
            stream_max_bytes: 1_073_741_824,
            stream_max_age_seconds: 86_400,
            max_consecutive_errors: 50,
            svid_path: None,
        }
    }
}

/// Combined sequence + hash state protected by a single lock.
struct ChainState {
    seq: u64,
    prev_hash: Option<String>,
}

/// The auditd-to-NATS bridge.
///
/// Holds the signing keypair, NATS client, and envelope sequence state.
pub struct Bridge {
    keypair: Keypair,
    nats_client: async_nats::Client,
    #[allow(dead_code)]
    js: async_nats::jetstream::Context,
    config: BridgeConfig,
    chain_state: Mutex<ChainState>,
    /// SPIFFE ID read from the workload SVID, if configured.
    spiffe_id: Option<String>,
}

impl Bridge {
    /// Create a new bridge from the given config.
    pub async fn new(config: BridgeConfig) -> Result<Self> {
        let keypair = match &config.signing_key_hex {
            Some(hex) if !hex.is_empty() => Keypair::from_hex(hex)?,
            _ => {
                info!("no signing key provided, generating ephemeral keypair");
                Keypair::generate()
            }
        };

        info!(
            issuer = %spine::issuer_from_keypair(&keypair),
            "bridge identity"
        );

        let nats_client = spine::nats_transport::connect(&config.nats_url).await?;
        let js = spine::nats_transport::jetstream(nats_client.clone());

        // Ensure the JetStream stream exists.
        let subjects = vec![format!("{NATS_SUBJECT_PREFIX}.>")];
        let max_bytes = (config.stream_max_bytes > 0).then_some(config.stream_max_bytes);
        let max_age = (config.stream_max_age_seconds > 0)
            .then(|| Duration::from_secs(config.stream_max_age_seconds));
        spine::nats_transport::ensure_stream_with_limits(
            &js,
            STREAM_NAME,
            subjects,
            config.stream_replicas,
            max_bytes,
            max_age,
        )
        .await?;

        // Read SPIFFE ID from SVID if configured.
        let spiffe_id = match &config.svid_path {
            Some(path) => match spine::spiffe::read_spiffe_id(path) {
                Ok(id) => {
                    info!(spiffe_id = %id, "loaded workload SPIFFE identity");
                    Some(id)
                }
                Err(e) => {
                    warn!(error = %e, path, "failed to read SPIFFE SVID, continuing without identity binding");
                    None
                }
            },
            None => None,
        };

        Ok(Self {
            keypair,
            nats_client,
            js,
            config,
            chain_state: Mutex::new(ChainState {
                seq: 1,
                prev_hash: None,
            }),
            spiffe_id,
        })
    }

    /// Run the bridge event loop.
    ///
    /// Tails the audit log, groups records, and publishes signed envelopes
    /// until an unrecoverable error occurs.
    pub async fn run(&self) -> Result<()> {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(4096);

        let tailer = AuditLogTailer::new(&self.config.audit_log_path, self.config.poll_interval_ms);

        // Spawn the tailer as a background task.
        let tailer_handle = tokio::spawn(async move {
            if let Err(e) = tailer.run(tx).await {
                tracing::error!(error = %e, "audit log tailer failed");
            }
        });

        info!(
            path = %self.config.audit_log_path,
            "tailing audit log"
        );

        let mut grouper = AuditEventGrouper::new(self.config.group_timeout_ms);
        let mut consecutive_errors: u64 = 0;
        let mut backoff = Duration::from_millis(100);
        let max_backoff = Duration::from_secs(30);

        loop {
            // Use a timeout to periodically flush the grouper even without new lines.
            let line = tokio::time::timeout(
                Duration::from_millis(self.config.group_timeout_ms),
                rx.recv(),
            )
            .await;

            let events = match line {
                Ok(Some(line)) => {
                    match parse_audit_line(&line) {
                        Ok(record) => grouper.add_record(record),
                        Err(e) => {
                            debug!(error = %e, "skipping unparseable audit line");
                            grouper.flush_expired()
                        }
                    }
                }
                Ok(None) => {
                    // Channel closed — tailer stopped.
                    warn!("audit log tailer channel closed");
                    break;
                }
                Err(_) => {
                    // Timeout — flush any expired groups.
                    grouper.flush_expired()
                }
            };

            for event in events {
                if let Err(e) = self.handle_event(&event).await {
                    consecutive_errors += 1;
                    warn!(
                        error = %e,
                        consecutive_errors,
                        "failed to handle audit event"
                    );
                    if consecutive_errors >= self.config.max_consecutive_errors {
                        return Err(Error::Config(format!(
                            "too many consecutive errors ({consecutive_errors}), giving up"
                        )));
                    }
                    tokio::time::sleep(backoff).await;
                    backoff = (backoff * 2).min(max_backoff);
                } else {
                    consecutive_errors = 0;
                    backoff = Duration::from_millis(100);
                }
            }
        }

        tailer_handle.abort();
        Ok(())
    }

    /// Handle a single grouped audit event: filter, map, sign, publish.
    async fn handle_event(&self, event: &AuditEvent) -> Result<()> {
        // Event type filter: if configured, only forward matching types.
        if !self.config.event_type_filter.is_empty()
            && !self.config.event_type_filter.contains(&event.primary_type)
        {
            debug!(
                event_type = event.primary_type.subject_suffix(),
                "skipping filtered event type"
            );
            return Ok(());
        }

        // Skip unknown events.
        if event.primary_type == AuditEventType::Unknown {
            debug!("skipping unknown event type");
            return Ok(());
        }

        // Map to fact JSON.
        let mut fact = match map_event(event) {
            Some(f) => f,
            None => {
                debug!("mapper returned None, skipping");
                return Ok(());
            }
        };

        // Inject SPIFFE workload identity into the fact if available.
        if let Some(ref spiffe_id) = self.spiffe_id {
            fact["spiffe_id"] = serde_json::Value::String(spiffe_id.clone());
        }

        // Build and sign the Spine envelope under a single lock, then drop the
        // guard before the async NATS publish.
        let (envelope, seq) = {
            let mut state = self.chain_state.lock().unwrap_or_else(|poisoned| {
                tracing::warn!("chain_state mutex was poisoned, recovering");
                poisoned.into_inner()
            });
            let seq = state.seq;
            let prev_hash = state.prev_hash.clone();

            let envelope = spine::build_signed_envelope(
                &self.keypair,
                seq,
                prev_hash,
                fact,
                spine::now_rfc3339(),
            )?;

            // Update chain state atomically.
            state.seq += 1;
            if let Some(hash) = envelope.get("envelope_hash").and_then(|v| v.as_str()) {
                state.prev_hash = Some(hash.to_string());
            }
            (envelope, seq)
        };

        // Publish to NATS.
        let subject = format!(
            "{NATS_SUBJECT_PREFIX}.{}.v1",
            event.subject_suffix()
        );

        if subject.is_empty()
            || !subject.is_ascii()
            || subject.contains(' ')
            || subject.contains('\n')
        {
            tracing::error!(subject = %subject, "invalid NATS subject, skipping publish");
            return Err(Error::Config(format!("invalid NATS subject: {subject}")));
        }

        let payload = serde_json::to_vec(&envelope)?;

        self.nats_client
            .publish(subject.clone(), payload.into())
            .await
            .map_err(|e| Error::Nats(format!("publish failed: {e}")))?;

        debug!(
            subject,
            seq,
            event_type = event.primary_type.subject_suffix(),
            serial = event.serial,
            "published envelope"
        );

        Ok(())
    }

    /// Get the NATS JetStream context (for testing or advanced usage).
    pub fn jetstream(&self) -> &async_nats::jetstream::Context {
        &self.js
    }

    /// Get the keypair issuer string.
    pub fn issuer(&self) -> String {
        spine::issuer_from_keypair(&self.keypair)
    }
}
