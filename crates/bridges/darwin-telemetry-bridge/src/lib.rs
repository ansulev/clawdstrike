#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

//! # darwin-telemetry-bridge
//!
//! Collects macOS process, filesystem, and log telemetry and publishes
//! runtime events as signed Spine envelopes to NATS JetStream.
//!
//! ## Architecture
//!
//! ```text
//! ProcessCollector ──┐
//! FsEventsCollector ─┤──► mpsc channel ──► handle_event() ──► Spine envelope ──► NATS
//! UnifiedLogCollector┘
//! ```
//!
//! The bridge:
//! 1. Spawns three collectors as tokio tasks feeding a shared mpsc channel
//! 2. Maps each event to a Spine fact via [`mapper`]
//! 3. Signs the fact into a [`spine::envelope`] using an Ed25519 keypair
//! 4. Publishes to NATS subject `clawdstrike.spine.envelope.darwin.{source}.{event_type}.v1`

pub mod error;
pub mod event;
#[cfg(target_os = "macos")]
pub mod fsevents;
pub mod mapper;
#[cfg(target_os = "macos")]
pub mod process;
#[cfg(target_os = "macos")]
pub mod unified_log;

#[cfg(target_os = "macos")]
mod bridge {
    use std::sync::Mutex;
    use std::time::Duration;

    use hush_core::Keypair;
    use tracing::{debug, info, warn};

    use crate::error::{Error, Result};
    use crate::event::{DarwinEvent, DarwinEventType};
    use crate::fsevents::FsEventsCollector;
    use crate::mapper::map_event;
    use crate::process::ProcessCollector;
    use crate::unified_log::UnifiedLogCollector;

    /// NATS subject prefix for all darwin bridge envelopes.
    const NATS_SUBJECT_PREFIX: &str = "clawdstrike.spine.envelope.darwin";

    /// NATS JetStream stream name.
    const STREAM_NAME: &str = "CLAWDSTRIKE_DARWIN";

    /// Configuration for the bridge.
    #[derive(Debug, Clone)]
    pub struct BridgeConfig {
        /// NATS server URL (e.g. `nats://localhost:4222`).
        pub nats_url: String,
        /// Hex-encoded Ed25519 seed for signing envelopes.
        /// If empty, a random keypair is generated.
        pub signing_key_hex: Option<String>,
        /// Event types to forward. If empty, all event types are forwarded.
        pub event_type_filter: Vec<DarwinEventType>,
        /// Number of JetStream replicas for the stream.
        pub stream_replicas: usize,
        /// Maximum bytes retained in the JetStream stream (0 = unlimited).
        pub stream_max_bytes: i64,
        /// Maximum age retained in the JetStream stream in seconds (0 = unlimited).
        pub stream_max_age_seconds: u64,
        /// Maximum consecutive handle_event errors before run() returns an error.
        pub max_consecutive_errors: u64,
        /// Path to SPIFFE SVID PEM file.
        pub svid_path: Option<String>,

        // --- Process collector ---
        /// Whether the process collector is enabled.
        pub process_collector_enabled: bool,
        /// Process poll interval in seconds.
        pub process_poll_interval_secs: u64,

        // --- FSEvents collector ---
        /// Whether the FSEvents collector is enabled.
        pub fsevents_collector_enabled: bool,
        /// Paths to watch with FSEvents.
        pub fsevents_watch_paths: Vec<String>,
        /// FSEvents latency in seconds.
        pub fsevents_latency_secs: f64,

        // --- Unified Log collector ---
        /// Whether the unified log collector is enabled.
        pub unified_log_collector_enabled: bool,
        /// Predicate for `log stream`.
        pub log_predicate: Option<String>,
    }

    impl Default for BridgeConfig {
        fn default() -> Self {
            Self {
                nats_url: "nats://localhost:4222".to_string(),
                signing_key_hex: None,
                event_type_filter: Vec::new(),
                stream_replicas: 1,
                stream_max_bytes: 1_073_741_824,
                stream_max_age_seconds: 86_400,
                max_consecutive_errors: 50,
                svid_path: None,
                process_collector_enabled: true,
                process_poll_interval_secs: 10,
                fsevents_collector_enabled: true,
                fsevents_watch_paths: Vec::new(),
                fsevents_latency_secs: 0.5,
                unified_log_collector_enabled: true,
                log_predicate: None,
            }
        }
    }

    /// Combined sequence + hash state protected by a single lock.
    struct ChainState {
        seq: u64,
        prev_hash: Option<String>,
    }

    /// The darwin-telemetry-to-NATS bridge.
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
        /// Spawns all enabled collectors and processes events through the
        /// signing + NATS publish pipeline until an unrecoverable error occurs.
        pub async fn run(&self) -> Result<()> {
            let (tx, mut rx) = tokio::sync::mpsc::channel::<DarwinEvent>(4096);

            // Spawn enabled collectors
            if self.config.process_collector_enabled {
                let collector = ProcessCollector::new(self.config.process_poll_interval_secs);
                let tx = tx.clone();
                tokio::spawn(async move {
                    if let Err(e) = collector.run(tx).await {
                        tracing::error!(error = %e, "process collector failed");
                    }
                });
                info!("process collector started");
            }

            if self.config.fsevents_collector_enabled {
                let collector = FsEventsCollector::new(
                    self.config.fsevents_watch_paths.clone(),
                    self.config.fsevents_latency_secs,
                );
                let tx = tx.clone();
                tokio::spawn(async move {
                    if let Err(e) = collector.run(tx).await {
                        tracing::error!(error = %e, "fsevents collector failed");
                    }
                });
                info!("fsevents collector started");
            }

            if self.config.unified_log_collector_enabled {
                let collector = UnifiedLogCollector::new(self.config.log_predicate.clone());
                let tx = tx.clone();
                tokio::spawn(async move {
                    if let Err(e) = collector.run(tx).await {
                        tracing::error!(error = %e, "unified log collector failed");
                    }
                });
                info!("unified log collector started");
            }

            // Drop the original sender so the channel closes when all collectors exit.
            drop(tx);

            let mut consecutive_errors: u64 = 0;
            let mut backoff = Duration::from_millis(100);
            let max_backoff = Duration::from_secs(30);

            loop {
                match rx.recv().await {
                    Some(event) => {
                        if let Err(e) = self.handle_event(&event).await {
                            consecutive_errors += 1;
                            warn!(
                                error = %e,
                                consecutive_errors,
                                "failed to handle darwin event"
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
                    None => {
                        warn!("all collectors exited, channel closed");
                        break;
                    }
                }
            }

            Ok(())
        }

        /// Handle a single event: filter, map, sign, publish.
        async fn handle_event(&self, event: &DarwinEvent) -> Result<()> {
            // Event type filter: if configured, only forward matching types.
            if !self.config.event_type_filter.is_empty()
                && !self.config.event_type_filter.contains(&event.event_type)
            {
                debug!(
                    event_type = event.event_type.subject_suffix(),
                    "skipping filtered event type"
                );
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

            // Build and sign the Spine envelope under a single lock, then drop
            // the guard before the async NATS publish.
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
            let subject = format!("{NATS_SUBJECT_PREFIX}.{}.v1", event.subject_suffix());

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
                event_type = event.event_type.subject_suffix(),
                source = event.source.as_str(),
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
}

#[cfg(target_os = "macos")]
pub use bridge::{Bridge, BridgeConfig};

#[cfg(test)]
mod tests {
    use crate::error::Error;
    use crate::event::{DarwinEventType, EventSource};
    use crate::mapper::FACT_SCHEMA;

    #[test]
    fn error_variants_display() {
        let err = Error::Config("test config error".to_string());
        assert!(err.to_string().contains("test config error"));

        let err = Error::Nats("connection refused".to_string());
        assert!(err.to_string().contains("connection refused"));

        let err = Error::Process("snapshot failed".to_string());
        assert!(err.to_string().contains("snapshot failed"));

        let err = Error::FsEvents("stream died".to_string());
        assert!(err.to_string().contains("stream died"));

        let err = Error::UnifiedLog("parse error".to_string());
        assert!(err.to_string().contains("parse error"));

        let err = Error::Channel("send failed".to_string());
        assert!(err.to_string().contains("send failed"));
    }

    #[test]
    fn fact_schema_is_well_formed() {
        assert!(FACT_SCHEMA.starts_with("clawdstrike.sdr.fact."));
        assert!(FACT_SCHEMA.ends_with(".v1"));
        assert!(FACT_SCHEMA.contains("darwin_telemetry_event"));
    }

    #[test]
    fn event_types_have_consistent_sources() {
        // Every event type's source().as_str() should appear in its full subject suffix
        let all_types = [
            DarwinEventType::ProcessSnapshot,
            DarwinEventType::ProcessSpawn,
            DarwinEventType::ProcessExit,
            DarwinEventType::FileCreated,
            DarwinEventType::FileModified,
            DarwinEventType::FileRemoved,
            DarwinEventType::FileRenamed,
            DarwinEventType::XattrChanged,
            DarwinEventType::OwnerChanged,
            DarwinEventType::SecurityLog,
            DarwinEventType::AuthLog,
            DarwinEventType::SudoLog,
            DarwinEventType::DirectoryLog,
        ];
        for t in &all_types {
            let event = crate::event::DarwinEvent {
                event_type: *t,
                source: t.source(),
                timestamp: "t".to_string(),
                payload: serde_json::json!({}),
            };
            let suffix = event.subject_suffix();
            assert!(
                suffix.starts_with(t.source().as_str()),
                "{:?} subject_suffix '{}' does not start with source '{}'",
                t,
                suffix,
                t.source().as_str()
            );
            assert!(
                suffix.ends_with(t.subject_suffix()),
                "{:?} full suffix '{}' does not end with type suffix '{}'",
                t,
                suffix,
                t.subject_suffix()
            );
        }
    }

    #[test]
    fn nats_subject_format_is_valid_for_all_types() {
        // Verify that all event type subject suffixes produce valid NATS subject components
        // (no spaces, newlines, non-ASCII)
        let all_types = [
            DarwinEventType::ProcessSnapshot,
            DarwinEventType::ProcessSpawn,
            DarwinEventType::ProcessExit,
            DarwinEventType::FileCreated,
            DarwinEventType::FileModified,
            DarwinEventType::FileRemoved,
            DarwinEventType::FileRenamed,
            DarwinEventType::XattrChanged,
            DarwinEventType::OwnerChanged,
            DarwinEventType::SecurityLog,
            DarwinEventType::AuthLog,
            DarwinEventType::SudoLog,
            DarwinEventType::DirectoryLog,
        ];
        for t in &all_types {
            let event = crate::event::DarwinEvent {
                event_type: *t,
                source: t.source(),
                timestamp: "t".to_string(),
                payload: serde_json::json!({}),
            };
            let suffix = event.subject_suffix();
            let subject = format!("clawdstrike.spine.envelope.darwin.{suffix}.v1");
            assert!(subject.is_ascii(), "non-ASCII subject for {:?}", t);
            assert!(!subject.contains(' '), "space in subject for {:?}", t);
            assert!(!subject.contains('\n'), "newline in subject for {:?}", t);
            assert!(!subject.is_empty(), "empty subject for {:?}", t);
        }
    }

    #[test]
    fn all_event_sources_represented() {
        // Ensure the three source types all have at least one event type
        let all_types = [
            DarwinEventType::ProcessSnapshot,
            DarwinEventType::ProcessSpawn,
            DarwinEventType::ProcessExit,
            DarwinEventType::FileCreated,
            DarwinEventType::FileModified,
            DarwinEventType::FileRemoved,
            DarwinEventType::FileRenamed,
            DarwinEventType::XattrChanged,
            DarwinEventType::OwnerChanged,
            DarwinEventType::SecurityLog,
            DarwinEventType::AuthLog,
            DarwinEventType::SudoLog,
            DarwinEventType::DirectoryLog,
        ];
        let has_process = all_types.iter().any(|t| t.source() == EventSource::Process);
        let has_fs = all_types
            .iter()
            .any(|t| t.source() == EventSource::FsEvents);
        let has_log = all_types
            .iter()
            .any(|t| t.source() == EventSource::UnifiedLog);
        assert!(has_process, "no Process event types found");
        assert!(has_fs, "no FsEvents event types found");
        assert!(has_log, "no UnifiedLog event types found");
    }

    // BridgeConfig tests — these compile on macOS where the type exists.
    // The test functions themselves have no #[cfg(target_os)] gate.
    #[cfg(target_os = "macos")]
    mod bridge_config_tests {
        use crate::BridgeConfig;

        #[test]
        fn bridge_config_default_nats_url() {
            let config = BridgeConfig::default();
            assert_eq!(config.nats_url, "nats://localhost:4222");
        }

        #[test]
        fn bridge_config_default_signing_key_is_none() {
            let config = BridgeConfig::default();
            assert!(config.signing_key_hex.is_none());
        }

        #[test]
        fn bridge_config_default_event_filter_is_empty() {
            let config = BridgeConfig::default();
            assert!(config.event_type_filter.is_empty());
        }

        #[test]
        fn bridge_config_default_stream_settings() {
            let config = BridgeConfig::default();
            assert_eq!(config.stream_replicas, 1);
            assert_eq!(config.stream_max_bytes, 1_073_741_824); // 1 GiB
            assert_eq!(config.stream_max_age_seconds, 86_400); // 24 hours
        }

        #[test]
        fn bridge_config_default_max_consecutive_errors() {
            let config = BridgeConfig::default();
            assert_eq!(config.max_consecutive_errors, 50);
        }

        #[test]
        fn bridge_config_default_svid_path_is_none() {
            let config = BridgeConfig::default();
            assert!(config.svid_path.is_none());
        }

        #[test]
        fn bridge_config_default_collectors_enabled() {
            let config = BridgeConfig::default();
            assert!(config.process_collector_enabled);
            assert!(config.fsevents_collector_enabled);
            assert!(config.unified_log_collector_enabled);
        }

        #[test]
        fn bridge_config_default_process_poll_interval() {
            let config = BridgeConfig::default();
            assert_eq!(config.process_poll_interval_secs, 10);
        }

        #[test]
        fn bridge_config_default_fsevents_settings() {
            let config = BridgeConfig::default();
            assert!(config.fsevents_watch_paths.is_empty());
            assert!((config.fsevents_latency_secs - 0.5).abs() < f64::EPSILON);
        }

        #[test]
        fn bridge_config_default_log_predicate_is_none() {
            let config = BridgeConfig::default();
            assert!(config.log_predicate.is_none());
        }

        #[test]
        fn bridge_config_clone() {
            let config = BridgeConfig::default();
            let cloned = config.clone();
            assert_eq!(cloned.nats_url, config.nats_url);
            assert_eq!(cloned.stream_replicas, config.stream_replicas);
            assert_eq!(cloned.max_consecutive_errors, config.max_consecutive_errors);
        }

        #[test]
        fn bridge_config_debug_impl() {
            let config = BridgeConfig::default();
            let debug_str = format!("{:?}", config);
            assert!(debug_str.contains("BridgeConfig"));
            assert!(debug_str.contains("nats://localhost:4222"));
        }
    }
}
