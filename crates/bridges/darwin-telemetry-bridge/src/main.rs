//! CLI entry point for the darwin-telemetry-bridge.
//!
//! ```text
//! darwin-telemetry-bridge \
//!   --nats-url nats://localhost:4222 \
//!   --signing-key 0xdeadbeef...
//! ```

#[cfg(not(target_os = "macos"))]
compile_error!("darwin-telemetry-bridge is only supported on macOS");

#[cfg(target_os = "macos")]
mod cli {
    use std::time::Duration;

    use clap::Parser;
    use tracing::{error, warn};
    use tracing_subscriber::EnvFilter;

    use darwin_telemetry_bridge::event::DarwinEventType;
    use darwin_telemetry_bridge::{Bridge, BridgeConfig};

    /// Darwin telemetry-to-NATS bridge: publishes signed Spine envelopes from
    /// macOS process, filesystem, and log telemetry.
    #[derive(Parser, Debug)]
    #[command(name = "darwin-telemetry-bridge", version, about)]
    pub struct Cli {
        /// NATS server URL.
        #[arg(long, default_value = "nats://localhost:4222", env = "NATS_URL")]
        nats_url: String,

        /// Hex-encoded Ed25519 seed for envelope signing.
        /// If omitted, an ephemeral keypair is generated.
        #[arg(env = "SIGNING_KEY")]
        signing_key: Option<String>,

        /// Event types to forward (comma-separated).
        /// If omitted, all event types are forwarded.
        #[arg(long, value_delimiter = ',', env = "EVENT_TYPE_FILTER")]
        event_type_filter: Vec<String>,

        /// Number of JetStream replicas for the envelope stream.
        #[arg(long, default_value = "1", env = "STREAM_REPLICAS")]
        stream_replicas: usize,

        /// Maximum bytes retained for the JetStream stream (0 = unlimited).
        #[arg(long, default_value = "1073741824", env = "STREAM_MAX_BYTES")]
        stream_max_bytes: i64,

        /// Maximum age retained for the JetStream stream in seconds (0 = unlimited).
        #[arg(long, default_value = "86400", env = "STREAM_MAX_AGE_SECONDS")]
        stream_max_age_seconds: u64,

        /// Maximum startup wait for NATS connectivity before retrying.
        #[arg(long, default_value = "90", env = "NATS_STARTUP_TIMEOUT_SECS")]
        nats_startup_timeout_secs: u64,

        /// Path to SPIFFE SVID PEM file.
        #[arg(long, env = "SVID_PATH")]
        svid_path: Option<String>,

        // --- Process collector ---
        /// Process table poll interval in seconds.
        #[arg(long, default_value = "10", env = "PROCESS_POLL_INTERVAL_SECS")]
        process_poll_interval_secs: u64,

        /// Enable the process collector.
        #[arg(long, default_value = "true", env = "PROCESS_COLLECTOR_ENABLED")]
        process_collector_enabled: bool,

        // --- FSEvents collector ---
        /// Paths to watch with FSEvents (comma-separated).
        #[arg(long, value_delimiter = ',', env = "FSEVENTS_WATCH_PATHS")]
        fsevents_watch_paths: Vec<String>,

        /// FSEvents coalescing latency in seconds.
        #[arg(long, default_value = "0.5", env = "FSEVENTS_LATENCY_SECS")]
        fsevents_latency_secs: f64,

        /// Enable the FSEvents collector.
        #[arg(long, default_value = "true", env = "FSEVENTS_COLLECTOR_ENABLED")]
        fsevents_collector_enabled: bool,

        // --- Unified Log collector ---
        /// Predicate filter for `log stream`.
        #[arg(long, env = "LOG_PREDICATE")]
        log_predicate: Option<String>,

        /// Enable the unified log collector.
        #[arg(long, default_value = "true", env = "UNIFIED_LOG_COLLECTOR_ENABLED")]
        unified_log_collector_enabled: bool,
    }

    fn parse_event_types(types: &[String]) -> Vec<DarwinEventType> {
        types
            .iter()
            .filter_map(|t| {
                let parsed = DarwinEventType::from_str_loose(t);
                if parsed.is_none() {
                    eprintln!("warning: unknown event type '{t}', ignoring");
                }
                parsed
            })
            .collect()
    }

    fn is_transient_nats_bootstrap_error(message: &str) -> bool {
        let lower = message.to_ascii_lowercase();
        lower.contains("failed to lookup address information")
            || lower.contains("temporary failure in name resolution")
            || lower.contains("name or service not known")
            || lower.contains("connection refused")
            || lower.contains("connection reset")
            || lower.contains("no route to host")
            || lower.contains("timed out")
    }

    async fn wait_for_nats_startup(nats_url: &str, timeout: Duration) -> anyhow::Result<()> {
        let deadline = tokio::time::Instant::now() + timeout;
        let mut attempt: u32 = 0;
        let mut backoff = Duration::from_millis(250);

        loop {
            attempt = attempt.saturating_add(1);
            match spine::nats_transport::connect(nats_url).await {
                Ok(client) => {
                    drop(client);
                    if attempt > 1 {
                        warn!(attempt, "NATS became reachable during startup");
                    }
                    return Ok(());
                }
                Err(err) => {
                    let transient = is_transient_nats_bootstrap_error(&err.to_string());
                    if !transient || tokio::time::Instant::now() >= deadline {
                        return Err(anyhow::anyhow!(
                            "NATS startup readiness failed after {attempt} attempts: {err}"
                        ));
                    }
                    warn!(
                        attempt,
                        backoff_ms = backoff.as_millis() as u64,
                        error = %err,
                        "waiting for NATS startup readiness"
                    );
                    tokio::time::sleep(backoff).await;
                    backoff = (backoff * 2).min(Duration::from_secs(5));
                }
            }
        }
    }

    pub async fn run() -> anyhow::Result<()> {
        tracing_subscriber::fmt()
            .with_env_filter(
                EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| EnvFilter::new("darwin_telemetry_bridge=info")),
            )
            .init();

        let cli = Cli::parse();

        let config = BridgeConfig {
            nats_url: cli.nats_url,
            signing_key_hex: cli.signing_key,
            event_type_filter: parse_event_types(&cli.event_type_filter),
            stream_replicas: cli.stream_replicas,
            stream_max_bytes: cli.stream_max_bytes,
            stream_max_age_seconds: cli.stream_max_age_seconds,
            svid_path: cli.svid_path,
            process_collector_enabled: cli.process_collector_enabled,
            process_poll_interval_secs: cli.process_poll_interval_secs,
            fsevents_collector_enabled: cli.fsevents_collector_enabled,
            fsevents_watch_paths: cli.fsevents_watch_paths,
            fsevents_latency_secs: cli.fsevents_latency_secs,
            unified_log_collector_enabled: cli.unified_log_collector_enabled,
            log_predicate: cli.log_predicate,
            ..BridgeConfig::default()
        };

        let mut backoff = Duration::from_secs(1);
        loop {
            let startup_timeout = Duration::from_secs(cli.nats_startup_timeout_secs);
            if let Err(e) = wait_for_nats_startup(&config.nats_url, startup_timeout).await {
                warn!(error = %e, "NATS startup readiness check failed, retrying");
                warn!(
                    backoff_secs = backoff.as_secs(),
                    "reconnecting after backoff"
                );
                tokio::time::sleep(backoff).await;
                backoff = (backoff * 2).min(Duration::from_secs(60));
                continue;
            }

            match Bridge::new(config.clone()).await {
                Ok(bridge) => {
                    backoff = Duration::from_secs(1);
                    match bridge.run().await {
                        Ok(()) => {
                            warn!("bridge stream ended, reconnecting...");
                        }
                        Err(e) => {
                            error!(error = %e, "bridge error, reconnecting...");
                        }
                    }
                }
                Err(e) => {
                    error!(error = %e, "failed to create bridge");
                }
            }
            warn!(
                backoff_secs = backoff.as_secs(),
                "reconnecting after backoff"
            );
            tokio::time::sleep(backoff).await;
            backoff = (backoff * 2).min(Duration::from_secs(60));
        }
    }
}

#[cfg(target_os = "macos")]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    cli::run().await
}
