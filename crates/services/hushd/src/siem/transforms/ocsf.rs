use crate::siem::types::{Outcome, ResourceType, SecurityEvent, SecurityEventType};
use clawdstrike_ocsf::convert::from_security_event::{to_ocsf_json, SecurityEventInput};

/// Convert a `SecurityEvent` to an OCSF Detection Finding JSON payload.
///
/// Delegates to the canonical `clawdstrike-ocsf` crate for OCSF v1.4.0 compliance.
pub fn to_ocsf(event: &SecurityEvent) -> serde_json::Value {
    let event_id = event.event_id.to_string();
    let severity = match event.decision.severity {
        crate::siem::types::SecuritySeverity::Info => "info",
        crate::siem::types::SecuritySeverity::Low => "low",
        crate::siem::types::SecuritySeverity::Medium => "medium",
        crate::siem::types::SecuritySeverity::High => "high",
        crate::siem::types::SecuritySeverity::Critical => "critical",
    };
    let outcome = match event.outcome {
        Outcome::Success => "success",
        Outcome::Failure => "failure",
        Outcome::Unknown => "unknown",
    };
    let resource_type = match event.resource.resource_type {
        ResourceType::File => "file",
        ResourceType::Network => "network",
        ResourceType::Process => "process",
        ResourceType::Tool => "tool",
        ResourceType::Configuration => "configuration",
    };

    let input = SecurityEventInput {
        event_id: &event_id,
        time_ms: event.timestamp.timestamp_millis(),
        allowed: event.decision.allowed,
        outcome,
        severity,
        guard: &event.decision.guard,
        reason: &event.decision.reason,
        product_version: &event.agent.version,
        action: &event.action,
        resource_type,
        resource_name: &event.resource.name,
        resource_path: event.resource.path.as_deref(),
        resource_host: event.resource.host.as_deref(),
        resource_port: event.resource.port,
        agent_id: &event.agent.id,
        agent_name: &event.agent.name,
        session_id: Some(&*event.session.id),
        is_warn: matches!(event.event_type, SecurityEventType::GuardWarn),
    };

    to_ocsf_json(&input)
}
