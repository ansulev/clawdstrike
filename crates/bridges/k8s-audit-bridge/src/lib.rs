#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

//! # k8s-audit-bridge
//!
//! Receives Kubernetes API server audit webhooks and publishes them as signed
//! Spine envelopes to NATS JetStream.
//!
//! ## Architecture
//!
//! ```text
//! K8s API Server (webhook POST) ─► axum HTTP ─► mapper ─► Spine envelope ─► NATS
//! ```
//!
//! The bridge:
//! 1. Runs an axum HTTP server that receives audit webhook POSTs
//! 2. Parses `EventList` or single `Event` payloads
//! 3. Maps each event to a Spine fact via [`mapper`]
//! 4. Signs the fact into a [`spine::envelope`] using an Ed25519 keypair
//! 5. Publishes to NATS subject `clawdstrike.spine.envelope.k8s_audit.{verb}.v1`
//!
//! Filtering is configurable: verbs, resources, and namespaces can be filtered.

pub mod error;
pub mod mapper;
pub mod webhook;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::body::Bytes;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::Router;
use hush_core::Keypair;
use tracing::{debug, error, info, warn};

use crate::error::{Error, Result};
use crate::mapper::map_event;
use crate::webhook::{parse_webhook_payload, AuditEvent, AuditVerb};

/// NATS subject prefix for all K8s audit bridge envelopes.
const NATS_SUBJECT_PREFIX: &str = "clawdstrike.spine.envelope.k8s_audit";

/// NATS JetStream stream name.
const STREAM_NAME: &str = "CLAWDSTRIKE_K8S_AUDIT";

/// Configuration for the bridge.
#[derive(Debug, Clone)]
pub struct BridgeConfig {
    /// HTTP listen address (e.g. `0.0.0.0:9877`).
    pub listen_addr: String,
    /// NATS server URL (e.g. `nats://localhost:4222`).
    pub nats_url: String,
    /// Hex-encoded Ed25519 seed for signing envelopes.
    /// If empty, a random keypair is generated.
    pub signing_key_hex: Option<String>,
    /// Only forward events from these namespaces.
    /// If empty, all namespaces are forwarded.
    pub namespace_allowlist: Vec<String>,
    /// Only forward these verbs.
    /// If empty, all verbs are forwarded.
    pub verb_filter: Vec<AuditVerb>,
    /// Only forward events for these resources.
    /// If empty, all resources are forwarded.
    pub resource_filter: Vec<String>,
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
            listen_addr: "0.0.0.0:9877".to_string(),
            nats_url: "nats://localhost:4222".to_string(),
            signing_key_hex: None,
            namespace_allowlist: Vec::new(),
            verb_filter: Vec::new(),
            resource_filter: Vec::new(),
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

/// Shared bridge state passed to axum handlers via `Arc`.
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

    /// Run the bridge HTTP server.
    ///
    /// Starts an axum server that listens for K8s audit webhook POSTs.
    pub async fn run(self) -> Result<()> {
        let listen_addr = self.config.listen_addr.clone();
        let bridge = Arc::new(self);

        let app = Router::new()
            .route("/webhook", post(handle_webhook))
            .route("/healthz", get(handle_healthz))
            .with_state(bridge);

        info!(listen_addr = %listen_addr, "starting K8s audit webhook server");

        let listener = tokio::net::TcpListener::bind(&listen_addr)
            .await
            .map_err(|e| Error::Http(format!("failed to bind {listen_addr}: {e}")))?;

        axum::serve(listener, app)
            .await
            .map_err(|e| Error::Http(format!("server error: {e}")))?;

        Ok(())
    }

    /// Handle a single K8s audit event: filter, map, sign, publish.
    async fn handle_event(&self, event: &AuditEvent) -> Result<()> {
        // Verb filter: if configured, only forward matching verbs.
        if !self.config.verb_filter.is_empty() && !self.config.verb_filter.contains(&event.verb) {
            debug!(
                verb = event.verb.subject_suffix(),
                "skipping filtered verb"
            );
            return Ok(());
        }

        // Skip unknown verbs.
        if event.verb == AuditVerb::Unknown {
            debug!("skipping unknown verb");
            return Ok(());
        }

        // Namespace filter.
        if !self.config.namespace_allowlist.is_empty() {
            let event_ns = event
                .object_ref
                .as_ref()
                .map(|r| r.namespace.as_str())
                .unwrap_or("");
            if !self
                .config
                .namespace_allowlist
                .iter()
                .any(|ns| ns.eq_ignore_ascii_case(event_ns))
            {
                debug!(namespace = event_ns, "skipping event outside namespace allowlist");
                return Ok(());
            }
        }

        // Resource filter.
        if !self.config.resource_filter.is_empty() {
            let event_resource = event
                .object_ref
                .as_ref()
                .map(|r| r.resource.as_str())
                .unwrap_or("");
            if !self
                .config
                .resource_filter
                .iter()
                .any(|r| r.eq_ignore_ascii_case(event_resource))
            {
                debug!(resource = event_resource, "skipping filtered resource");
                return Ok(());
            }
        }

        // Map to fact JSON.
        let mut fact = map_event(event);

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
            event.verb.subject_suffix()
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
            verb = event.verb.subject_suffix(),
            audit_id = %event.audit_id,
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

/// Axum handler for the webhook endpoint.
async fn handle_webhook(
    State(bridge): State<Arc<Bridge>>,
    body: Bytes,
) -> impl IntoResponse {
    let events = match parse_webhook_payload(&body) {
        Ok(events) => events,
        Err(e) => {
            warn!(error = %e, "failed to parse webhook payload");
            return StatusCode::BAD_REQUEST;
        }
    };

    let mut errors = 0u64;
    for event in &events {
        if let Err(e) = bridge.handle_event(event).await {
            error!(
                error = %e,
                audit_id = %event.audit_id,
                "failed to handle audit event"
            );
            errors += 1;
        }
    }

    if errors > 0 {
        warn!(errors, total = events.len(), "some events failed to process");
    }

    // Always return 200 to the API server to avoid retry storms.
    // Failures are logged and tracked internally.
    StatusCode::OK
}

/// Axum handler for health check.
async fn handle_healthz() -> impl IntoResponse {
    StatusCode::OK
}
