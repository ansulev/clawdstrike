//! Convert a Tetragon fact (JSON) to an OCSF Process Activity event.
//!
//! The converter takes `serde_json::Value` so the OCSF crate does not depend
//! on the tetragon-bridge crate.

use serde_json::Value;

use crate::classes::process_activity::{ProcessActivity, ProcessActivityType};
use crate::objects::file::OcsfFile;
use crate::objects::metadata::Metadata;
use crate::objects::process::{OcsfProcess, OcsfUser};
use crate::severity::map_severity;

/// Convert a Tetragon fact JSON to an OCSF ProcessActivity.
///
/// Returns `None` if the fact doesn't contain the expected structure.
#[must_use]
pub fn tetragon_fact_to_process_activity(
    fact: &Value,
    time_ms: i64,
    product_version: &str,
) -> Option<ProcessActivity> {
    let event_type = fact.get("event_type").and_then(|v| v.as_str())?;

    let activity = match event_type {
        "PROCESS_EXEC" => ProcessActivityType::Launch,
        "PROCESS_EXIT" => ProcessActivityType::Terminate,
        "PROCESS_KPROBE" => ProcessActivityType::Open,
        _ => ProcessActivityType::Other,
    };

    let process_obj = fact.get("process");
    let binary = process_obj
        .and_then(|p| p.get("binary"))
        .and_then(|b| b.as_str());
    let arguments = process_obj
        .and_then(|p| p.get("arguments"))
        .and_then(|a| a.as_str());
    let cwd = process_obj
        .and_then(|p| p.get("cwd"))
        .and_then(|c| c.as_str());
    let pid = process_obj
        .and_then(|p| p.get("pid"))
        .and_then(|p| p.as_u64())
        .and_then(|p| u32::try_from(p).ok());
    let uid = process_obj
        .and_then(|p| p.get("uid"))
        .and_then(process_uid_as_string);

    let severity_str = fact
        .get("severity")
        .and_then(|s| s.as_str())
        .unwrap_or("info");
    let severity_id = map_severity(severity_str);

    let file = binary.map(|b| OcsfFile {
        path: Some(b.to_string()),
        name: b.rsplit('/').next().map(String::from),
        uid: None,
        type_id: None,
        size: None,
        hashes: None,
    });

    let cmd_line = match (binary, arguments) {
        (Some(b), Some(a)) => Some(format!("{b} {a}")),
        (Some(b), None) => Some(b.to_string()),
        _ => None,
    };

    let process = OcsfProcess {
        pid,
        name: binary.map(|b| b.rsplit('/').next().unwrap_or(b).to_string()),
        cmd_line,
        file,
        user: uid.as_ref().map(|u| OcsfUser {
            name: None,
            uid: Some(u.clone()),
        }),
        parent_process: None,
        cwd: cwd.map(String::from),
    };

    let metadata = Metadata::clawdstrike(product_version);

    let summary = format!("{} {}", event_type.to_lowercase(), binary.unwrap_or("?"));

    Some(
        ProcessActivity::new(activity, time_ms, severity_id.as_u8(), 1, metadata, process)
            .with_message(summary),
    )
}

fn process_uid_as_string(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.to_string()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::validate::validate_ocsf_json;
    use serde_json::json;

    #[test]
    fn process_exec() {
        let fact = json!({
            "event_type": "PROCESS_EXEC",
            "process": {
                "binary": "/usr/bin/curl",
                "arguments": "https://example.com",
                "pid": 1234,
                "uid": 1000,
                "cwd": "/tmp"
            },
            "severity": "info"
        });

        let event = tetragon_fact_to_process_activity(&fact, 1_709_366_400_000, "0.1.3").unwrap();
        assert_eq!(event.class_uid, 1007);
        assert_eq!(event.type_uid, 100701); // Launch
        assert_eq!(event.process.pid, Some(1234));
        assert_eq!(event.process.name.as_deref(), Some("curl"));
        assert_eq!(
            event.process.cmd_line.as_deref(),
            Some("/usr/bin/curl https://example.com")
        );
        assert_eq!(event.process.cwd.as_deref(), Some("/tmp"));
        assert_eq!(
            event.process.user.as_ref().and_then(|u| u.uid.as_deref()),
            Some("1000")
        );

        let json_val = serde_json::to_value(&event).unwrap();
        let errors = validate_ocsf_json(&json_val);
        assert!(errors.is_empty(), "validation errors: {:?}", errors);
    }

    #[test]
    fn process_exit() {
        let fact = json!({
            "event_type": "PROCESS_EXIT",
            "process": {
                "binary": "/usr/bin/ls",
                "pid": 5678
            }
        });

        let event = tetragon_fact_to_process_activity(&fact, 0, "0.1.3").unwrap();
        assert_eq!(event.type_uid, 100702); // Terminate
    }

    #[test]
    fn process_kprobe() {
        let fact = json!({
            "event_type": "PROCESS_KPROBE",
            "process": {
                "binary": "/usr/bin/strace",
                "pid": 9999
            },
            "severity": "high"
        });

        let event = tetragon_fact_to_process_activity(&fact, 0, "0.1.3").unwrap();
        assert_eq!(event.type_uid, 100703); // Open
        assert_eq!(event.severity_id, 4); // High
    }

    #[test]
    fn missing_event_type_returns_none() {
        let fact = json!({
            "process": { "binary": "/bin/sh" }
        });
        assert!(tetragon_fact_to_process_activity(&fact, 0, "0.1.3").is_none());
    }
}
