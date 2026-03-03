//! JSONL read/write helpers for PolicyEvent streams.

use std::io::{BufRead, Write};

use crate::event::{PolicyEvent, PolicyEventType};

/// Parse JSONL from a buffered reader, yielding one `PolicyEvent` per line.
pub fn read_events(reader: impl BufRead) -> impl Iterator<Item = anyhow::Result<PolicyEvent>> {
    reader.lines().enumerate().filter_map(|(idx, line)| {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                return Some(Err(anyhow::anyhow!(
                    "read error at line {}: {}",
                    idx + 1,
                    e
                )))
            }
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }
        Some(
            serde_json::from_str::<PolicyEvent>(trimmed).map_err(|e| {
                anyhow::anyhow!("invalid PolicyEvent JSONL at line {}: {}", idx + 1, e)
            }),
        )
    })
}

/// Parse an entire JSONL string into a vec of events.
pub fn read_events_from_str(jsonl: &str) -> anyhow::Result<Vec<PolicyEvent>> {
    let cursor = std::io::Cursor::new(jsonl);
    let reader = std::io::BufReader::new(cursor);
    read_events(reader).collect()
}

/// Write a single event as a JSONL line.
pub fn write_event(writer: &mut impl Write, event: &PolicyEvent) -> anyhow::Result<()> {
    let json = serde_json::to_string(event)?;
    writeln!(writer, "{}", json)?;
    Ok(())
}

/// Write multiple events as JSONL lines.
pub fn write_events(writer: &mut impl Write, events: &[PolicyEvent]) -> anyhow::Result<()> {
    for event in events {
        write_event(writer, event)?;
    }
    Ok(())
}

/// Filter events by event type. Returns all events if `event_types` is `None`.
#[must_use]
pub fn filter_events(
    events: Vec<PolicyEvent>,
    event_types: Option<&[PolicyEventType]>,
) -> Vec<PolicyEvent> {
    let Some(types) = event_types else {
        return events;
    };

    events
        .into_iter()
        .filter(|e| types.contains(&e.event_type))
        .collect()
}

#[cfg(test)]
mod tests {
    #![allow(clippy::expect_used, clippy::unwrap_used)]

    use super::*;
    use crate::event::{FileEventData, NetworkEventData, PolicyEventData};
    use chrono::Utc;

    fn sample_event(id: &str, event_type: PolicyEventType) -> PolicyEvent {
        PolicyEvent {
            event_id: id.to_string(),
            event_type,
            timestamp: Utc::now(),
            session_id: None,
            data: PolicyEventData::File(FileEventData {
                path: "/tmp/test".to_string(),
                operation: None,
                content_base64: None,
                content: None,
                content_hash: None,
            }),
            metadata: None,
            context: None,
        }
    }

    #[test]
    fn roundtrip_write_read() {
        let events = vec![
            sample_event("e1", PolicyEventType::FileRead),
            sample_event("e2", PolicyEventType::FileRead),
        ];

        let mut buf = Vec::new();
        write_events(&mut buf, &events).unwrap();

        let parsed = read_events_from_str(&String::from_utf8(buf).unwrap()).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].event_id, "e1");
        assert_eq!(parsed[1].event_id, "e2");
    }

    #[test]
    fn filter_by_type() {
        let events = vec![
            sample_event("e1", PolicyEventType::FileRead),
            PolicyEvent {
                event_id: "e2".to_string(),
                event_type: PolicyEventType::NetworkEgress,
                timestamp: Utc::now(),
                session_id: None,
                data: PolicyEventData::Network(NetworkEventData {
                    host: "example.com".to_string(),
                    port: 443,
                    protocol: None,
                    url: None,
                }),
                metadata: None,
                context: None,
            },
            sample_event("e3", PolicyEventType::FileWrite),
        ];

        let filtered = filter_events(events, Some(&[PolicyEventType::FileRead]));
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].event_id, "e1");
    }

    #[test]
    fn filter_none_returns_all() {
        let events = vec![
            sample_event("e1", PolicyEventType::FileRead),
            sample_event("e2", PolicyEventType::FileWrite),
        ];

        let filtered = filter_events(events, None);
        assert_eq!(filtered.len(), 2);
    }

    #[test]
    fn read_events_skips_blank_lines() {
        let jsonl = format!(
            "{}\n\n{}\n",
            serde_json::to_string(&sample_event("e1", PolicyEventType::FileRead)).unwrap(),
            serde_json::to_string(&sample_event("e2", PolicyEventType::FileRead)).unwrap(),
        );
        let parsed = read_events_from_str(&jsonl).unwrap();
        assert_eq!(parsed.len(), 2);
    }
}
