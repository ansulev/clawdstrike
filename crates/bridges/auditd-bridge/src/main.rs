//! CLI entry point for the auditd-bridge.
//!
//! ```text
//! auditd-bridge \
//!   --audit-log-path /var/log/audit/audit.log \
//!   --nats-url nats://localhost:4222 \
//!   --signing-key 0xdeadbeef...
//! ```

use std::time::Duration;

use clap::Parser;
use tracing::{error, warn};
use tracing_subscriber::EnvFilter;

use auditd_bridge::{audit::AuditEventType, Bridge, BridgeConfig};

/// Auditd-to-NATS bridge: publishes signed Spine envelopes from Linux audit
/// daemon events.
#[derive(Parser, Debug)]
#[command(name = "auditd-bridge", version, about)]
struct Cli {
    /// Path to the audit log file.
    #[arg(
        long,
        default_value = "/var/log/audit/audit.log",
        env = "AUDIT_LOG_PATH"
    )]
    audit_log_path: String,

    /// NATS server URL.
    #[arg(long, default_value = "nats://localhost:4222", env = "NATS_URL")]
    nats_url: String,

    /// Hex-encoded Ed25519 seed for envelope signing.
    /// If omitted, an ephemeral keypair is generated.
    #[arg(env = "SIGNING_KEY")]
    signing_key: Option<String>,

    /// Event types to forward (comma-separated).
    /// Valid: syscall, execve, user_auth, user_login, user_cmd, avc, integrity, proctitle
    /// If omitted, all event types are forwarded.
    #[arg(long, value_delimiter = ',', env = "EVENT_TYPE_FILTER")]
    event_type_filter: Vec<String>,

    /// Timeout in milliseconds for grouping multi-line audit records by serial.
    #[arg(long, default_value = "500", env = "GROUP_TIMEOUT_MS")]
    group_timeout_ms: u64,

    /// Number of JetStream replicas for the envelope stream.
    #[arg(long, default_value = "1", env = "STREAM_REPLICAS")]
    stream_replicas: usize,

    /// Maximum bytes retained for the auditd JetStream stream (0 = unlimited).
    #[arg(long, default_value = "1073741824", env = "STREAM_MAX_BYTES")]
    stream_max_bytes: i64,

    /// Maximum age retained for the auditd JetStream stream in seconds (0 = unlimited).
    #[arg(long, default_value = "86400", env = "STREAM_MAX_AGE_SECONDS")]
    stream_max_age_seconds: u64,

    /// Maximum startup wait for NATS connectivity before backing off and retrying.
    #[arg(long, default_value = "90", env = "NATS_STARTUP_TIMEOUT_SECS")]
    nats_startup_timeout_secs: u64,

    /// Path to SPIFFE SVID PEM file. When set, the bridge reads the workload
    /// SPIFFE ID and includes it in every published fact.
    #[arg(long, env = "SVID_PATH")]
    svid_path: Option<String>,
}

fn parse_event_types(types: &[String]) -> Vec<AuditEventType> {
    types
        .iter()
        .filter_map(|t| match t.trim().to_lowercase().as_str() {
            "syscall" => Some(AuditEventType::Syscall),
            "execve" => Some(AuditEventType::Execve),
            "user_auth" => Some(AuditEventType::UserAuth),
            "user_login" => Some(AuditEventType::UserLogin),
            "user_cmd" => Some(AuditEventType::UserCmd),
            "avc" => Some(AuditEventType::Avc),
            "integrity" => Some(AuditEventType::IntegrityData),
            "proctitle" => Some(AuditEventType::Proctitle),
            other => {
                eprintln!("warning: unknown event type '{other}', ignoring");
                None
            }
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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("auditd_bridge=info")),
        )
        .init();

    let cli = Cli::parse();

    let config = BridgeConfig {
        audit_log_path: cli.audit_log_path,
        nats_url: cli.nats_url,
        signing_key_hex: cli.signing_key,
        event_type_filter: parse_event_types(&cli.event_type_filter),
        group_timeout_ms: cli.group_timeout_ms,
        stream_replicas: cli.stream_replicas,
        stream_max_bytes: cli.stream_max_bytes,
        stream_max_age_seconds: cli.stream_max_age_seconds,
        svid_path: cli.svid_path,
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
