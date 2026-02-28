//! NATS JetStream replay consumer for historical envelope retrieval.

use std::time::Duration;

use async_nats::jetstream::consumer::pull;
use serde_json::Value;
use tokio_stream::StreamExt;

use crate::error::{Error, Result};
use crate::query::{EventSource, HuntQuery};
use crate::timeline::{self, TimelineEvent};

/// Default timeout for historical replay: if no new messages arrive within
/// this duration after we have already received at least one message, we
/// treat the historical backlog as fully drained and stop.
const DEFAULT_REPLAY_TIMEOUT: Duration = Duration::from_secs(3);

/// Replay envelopes from a single JetStream stream, filtered by query predicates.
///
/// Uses a timeout mechanism to detect when the historical backlog has been
/// drained: after receiving at least one message, if no new message arrives
/// within [`DEFAULT_REPLAY_TIMEOUT`], the stream is considered exhausted.
pub async fn replay_stream(
    js: &async_nats::jetstream::Context,
    source: &EventSource,
    query: &HuntQuery,
    verify: bool,
) -> Result<Vec<TimelineEvent>> {
    replay_stream_with_timeout(js, source, query, verify, DEFAULT_REPLAY_TIMEOUT).await
}

/// Like [`replay_stream`] but with a caller-specified idle timeout.
pub async fn replay_stream_with_timeout(
    js: &async_nats::jetstream::Context,
    source: &EventSource,
    query: &HuntQuery,
    verify: bool,
    idle_timeout: Duration,
) -> Result<Vec<TimelineEvent>> {
    let stream_name = source.stream_name();

    // Get stream — if missing, warn and return empty
    let stream = match js.get_stream(stream_name).await {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("stream {stream_name} not found, skipping: {e}");
            return Ok(Vec::new());
        }
    };

    // Build consumer config with time-based delivery if start is specified
    let deliver_policy = if let Some(ref start) = query.start {
        let ts = start.timestamp();
        let offset_dt = time::OffsetDateTime::from_unix_timestamp(ts)
            .unwrap_or(time::OffsetDateTime::UNIX_EPOCH);
        async_nats::jetstream::consumer::DeliverPolicy::ByStartTime {
            start_time: offset_dt,
        }
    } else {
        async_nats::jetstream::consumer::DeliverPolicy::All
    };

    let config = pull::Config {
        filter_subject: source.subject_filter().to_string(),
        deliver_policy,
        ..Default::default()
    };

    let consumer = stream.create_consumer(config).await.map_err(|e| {
        Error::JetStream(format!("failed to create consumer on {stream_name}: {e}"))
    })?;

    let mut messages = consumer.messages().await.map_err(|e| {
        Error::JetStream(format!(
            "failed to get message stream from {stream_name}: {e}"
        ))
    })?;

    let mut events = Vec::new();
    let mut received_any = false;

    loop {
        let msg_result = if received_any {
            // After receiving at least one message, apply an idle timeout so
            // we don't block forever waiting for new messages once the
            // historical backlog is drained.
            match tokio::time::timeout(idle_timeout, messages.next()).await {
                Ok(Some(r)) => r,
                Ok(None) => break, // stream ended
                Err(_elapsed) => {
                    tracing::debug!(
                        "replay idle timeout ({idle_timeout:?}) on {stream_name}, \
                         treating as end-of-stream"
                    );
                    break;
                }
            }
        } else {
            // First message: use a longer initial timeout so we don't give up
            // too quickly if the consumer is still being created.
            match tokio::time::timeout(idle_timeout * 3, messages.next()).await {
                Ok(Some(r)) => r,
                Ok(None) => break,
                Err(_elapsed) => {
                    tracing::debug!("no messages received within initial timeout on {stream_name}");
                    break;
                }
            }
        };

        let msg = match msg_result {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!("error reading message from {stream_name}: {e}");
                continue;
            }
        };

        received_any = true;

        // Acknowledge the message so the pull consumer does not redeliver it.
        msg.ack().await.ok();

        // Parse payload as JSON envelope
        let payload: Value = match serde_json::from_slice(&msg.payload) {
            Ok(v) => v,
            Err(e) => {
                tracing::debug!("skipping non-JSON message from {stream_name}: {e}");
                continue;
            }
        };

        // Parse envelope into TimelineEvent
        if let Some(event) = timeline::parse_envelope(&payload, verify) {
            // Stop if past end time
            if let Some(ref end) = query.end {
                if event.timestamp > *end {
                    break;
                }
            }

            if query.matches(&event) {
                events.push(event);
                if events.len() >= query.limit {
                    break;
                }
            }
        }
    }

    Ok(events)
}

/// Replay and merge envelopes from all query sources.
pub async fn replay_all(
    query: &HuntQuery,
    nats_url: &str,
    nats_creds: Option<&str>,
    verify: bool,
) -> Result<Vec<TimelineEvent>> {
    let auth = nats_creds.map(|c| spine::nats_transport::NatsAuthConfig {
        creds_file: Some(c.to_string()),
        token: None,
        nkey_seed: None,
    });

    let client = spine::nats_transport::connect_with_auth(nats_url, auth.as_ref())
        .await
        .map_err(|e| Error::Nats(format!("failed to connect to NATS at {nats_url}: {e}")))?;

    let js = spine::nats_transport::jetstream(client);

    let mut all_events = Vec::new();

    for source in &query.effective_sources() {
        match replay_stream(&js, source, query, verify).await {
            Ok(events) => all_events.extend(events),
            Err(e) => {
                tracing::warn!("failed to replay {source} stream: {e}");
            }
        }
    }

    let mut merged = timeline::merge_timeline(all_events);
    merged.truncate(query.limit);
    Ok(merged)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_replay_timeout_is_reasonable() {
        // The default idle timeout should be between 1 and 10 seconds.
        assert!(
            DEFAULT_REPLAY_TIMEOUT >= Duration::from_secs(1),
            "timeout should be at least 1s"
        );
        assert!(
            DEFAULT_REPLAY_TIMEOUT <= Duration::from_secs(10),
            "timeout should be at most 10s"
        );
    }

    #[test]
    fn initial_timeout_is_triple_idle() {
        // The initial timeout (for the first message) is 3x the idle timeout.
        // Verify the multiplication doesn't overflow for reasonable values.
        let timeout = DEFAULT_REPLAY_TIMEOUT;
        let initial = timeout * 3;
        assert_eq!(initial, Duration::from_secs(9));
    }

    /// Verify that `replay_all` returns an error (not a hang) when NATS is
    /// unreachable.
    #[tokio::test]
    async fn replay_all_unreachable_nats_returns_error() {
        let query = HuntQuery::default();
        // Use a port that is almost certainly not running NATS.
        let result = replay_all(&query, "nats://127.0.0.1:14223", None, false).await;
        assert!(result.is_err(), "should fail when NATS is unreachable");
    }
}
