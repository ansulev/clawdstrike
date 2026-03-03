//! Convert a Hubble flow fact (JSON) to an OCSF Network Activity event.
//!
//! The converter takes `serde_json::Value` so the OCSF crate does not depend
//! on the hubble-bridge crate.

use serde_json::Value;

use crate::classes::network_activity::{NetworkActivity, NetworkActivityType};
use crate::objects::metadata::Metadata;
use crate::objects::network_endpoint::{ConnectionInfo, NetworkEndpoint};
use crate::severity::map_severity;

/// Convert a Hubble flow fact JSON to an OCSF NetworkActivity.
///
/// Returns `None` if the fact doesn't contain the expected structure.
#[must_use]
pub fn hubble_fact_to_network_activity(
    fact: &Value,
    time_ms: i64,
    product_version: &str,
) -> Option<NetworkActivity> {
    let verdict = fact.get("verdict").and_then(|v| v.as_str())?;

    let activity = match verdict {
        "FORWARDED" => NetworkActivityType::Traffic,
        "DROPPED" => NetworkActivityType::Refuse,
        "ERROR" => NetworkActivityType::Fail,
        _ => NetworkActivityType::Other,
    };

    let severity_str = fact
        .get("severity")
        .and_then(|s| s.as_str())
        .unwrap_or(match verdict {
            "DROPPED" => "high",
            "ERROR" => "high",
            _ => "info",
        });
    let severity_id = map_severity(severity_str);

    let status_id = match verdict {
        "FORWARDED" => 1,         // Success
        "DROPPED" | "ERROR" => 2, // Failure
        _ => 0,                   // Unknown
    };

    let metadata = Metadata::clawdstrike(product_version);

    let src_endpoint = extract_endpoint(fact.get("source"));
    let dst_endpoint = extract_endpoint(fact.get("destination"));

    let src_ip = fact
        .get("ip")
        .and_then(|ip| ip.get("source"))
        .and_then(|s| s.as_str());
    let dst_ip = fact
        .get("ip")
        .and_then(|ip| ip.get("destination"))
        .and_then(|d| d.as_str());

    // Merge IP info into endpoints.
    let src_endpoint = merge_ip(src_endpoint, src_ip);
    let dst_endpoint = merge_ip(dst_endpoint, dst_ip);

    let (connection_info, l4_src_port, l4_dst_port) = extract_connection_info(fact);

    // Merge L4 ports into endpoints.
    let src_endpoint = merge_port(src_endpoint, l4_src_port);
    let dst_endpoint = merge_port(dst_endpoint, l4_dst_port);

    let direction = fact
        .get("traffic_direction")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let summary = fact
        .get("summary")
        .and_then(|v| v.as_str())
        .unwrap_or("network flow");

    let action_id = match verdict {
        "FORWARDED" => Some(1u8), // Allowed
        "DROPPED" => Some(2),     // Denied
        _ => None,
    };

    let disposition_id = match verdict {
        "FORWARDED" => Some(1u8), // Allowed
        "DROPPED" => Some(2),     // Blocked
        _ => None,
    };

    let mut event =
        NetworkActivity::new(activity, time_ms, severity_id.as_u8(), status_id, metadata)
            .with_message(format!("{} {}", direction.to_lowercase(), summary));

    if let Some(src) = src_endpoint {
        event = event.with_src_endpoint(src);
    }
    if let Some(dst) = dst_endpoint {
        event = event.with_dst_endpoint(dst);
    }
    if let Some(ci) = connection_info {
        event = event.with_connection_info(ci);
    }
    if let Some(aid) = action_id {
        event = event.with_action_id(aid);
    }
    if let Some(did) = disposition_id {
        event = event.with_disposition_id(did);
    }

    Some(event)
}

fn extract_endpoint(source: Option<&Value>) -> Option<NetworkEndpoint> {
    let source = source?;
    Some(NetworkEndpoint {
        ip: None,
        port: None,
        domain: None,
        hostname: source
            .get("pod_name")
            .or_else(|| source.get("hostname"))
            .and_then(|v| v.as_str())
            .map(String::from),
        subnet_uid: source
            .get("namespace")
            .and_then(|v| v.as_str())
            .map(String::from),
    })
}

fn merge_ip(endpoint: Option<NetworkEndpoint>, ip: Option<&str>) -> Option<NetworkEndpoint> {
    match (endpoint, ip) {
        (Some(mut ep), Some(ip_str)) => {
            ep.ip = Some(ip_str.to_string());
            Some(ep)
        }
        (None, Some(ip_str)) => Some(NetworkEndpoint {
            ip: Some(ip_str.to_string()),
            port: None,
            domain: None,
            hostname: None,
            subnet_uid: None,
        }),
        (ep, None) => ep,
    }
}

/// Returns `(connection_info, src_port, dst_port)`.
fn extract_connection_info(fact: &Value) -> (Option<ConnectionInfo>, Option<u16>, Option<u16>) {
    let l4 = match fact.get("l4") {
        Some(l4) => l4,
        None => return (None, None, None),
    };

    let (protocol_name, protocol_num, src_port, dst_port) = if let Some(tcp) = l4.get("TCP") {
        (
            "TCP",
            6u8,
            parse_port(tcp.get("source_port")),
            parse_port(tcp.get("destination_port")),
        )
    } else if let Some(udp) = l4.get("UDP") {
        (
            "UDP",
            17,
            parse_port(udp.get("source_port")),
            parse_port(udp.get("destination_port")),
        )
    } else if let Some(protocol) = l4.get("protocol").and_then(|v| v.as_str()) {
        let protocol_upper = protocol.to_ascii_uppercase();
        let (protocol_name, protocol_num) = match protocol_upper.as_str() {
            "TCP" => ("TCP", 6u8),
            "UDP" => ("UDP", 17u8),
            "SCTP" => ("SCTP", 132u8),
            "ICMPV4" => ("ICMPv4", 1u8),
            "ICMPV6" => ("ICMPv6", 58u8),
            _ => return (None, None, None),
        };
        (
            protocol_name,
            protocol_num,
            parse_port(l4.get("source_port")),
            parse_port(l4.get("destination_port")),
        )
    } else {
        return (None, None, None);
    };

    let direction = fact.get("traffic_direction").and_then(|v| v.as_str());
    let direction_id = match direction {
        Some("INGRESS") => Some(1u8),
        Some("EGRESS") => Some(2),
        _ => Some(0),
    };

    (
        Some(ConnectionInfo {
            protocol_name: Some(protocol_name.to_string()),
            protocol_num: Some(protocol_num),
            direction: direction.map(|d| d.to_string()),
            direction_id,
        }),
        src_port,
        dst_port,
    )
}

fn parse_port(value: Option<&Value>) -> Option<u16> {
    value
        .and_then(|v| v.as_u64())
        .and_then(|p| u16::try_from(p).ok())
}

fn merge_port(endpoint: Option<NetworkEndpoint>, port: Option<u16>) -> Option<NetworkEndpoint> {
    match (endpoint, port) {
        (Some(mut ep), Some(p)) => {
            ep.port = Some(p);
            Some(ep)
        }
        (Some(ep), None) => Some(ep),
        (None, Some(p)) => Some(NetworkEndpoint {
            ip: None,
            port: Some(p),
            domain: None,
            hostname: None,
            subnet_uid: None,
        }),
        (None, None) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::validate::validate_ocsf_json;
    use serde_json::json;

    #[test]
    fn forwarded_flow() {
        let fact = json!({
            "verdict": "FORWARDED",
            "traffic_direction": "EGRESS",
            "summary": "TCP 10.0.0.1:8080 -> 93.184.216.34:443",
            "source": {
                "namespace": "production",
                "pod_name": "web-server-xyz"
            },
            "destination": {
                "namespace": "external"
            },
            "ip": {
                "source": "10.0.0.1",
                "destination": "93.184.216.34"
            },
            "l4": {
                "TCP": {
                    "source_port": 8080,
                    "destination_port": 443
                }
            }
        });

        let event = hubble_fact_to_network_activity(&fact, 1_709_366_400_000, "0.1.3").unwrap();
        assert_eq!(event.class_uid, 4001);
        assert_eq!(event.type_uid, 400106); // Traffic
        assert_eq!(event.severity_id, 1); // Info
        assert_eq!(event.status_id, 1); // Success
        assert_eq!(event.action_id, Some(1)); // Allowed
        assert_eq!(event.disposition_id, Some(1)); // Allowed

        let src = event.src_endpoint.as_ref().unwrap();
        assert_eq!(src.ip.as_deref(), Some("10.0.0.1"));
        assert_eq!(src.port, Some(8080));
        assert_eq!(src.hostname.as_deref(), Some("web-server-xyz"));

        let dst = event.dst_endpoint.as_ref().unwrap();
        assert_eq!(dst.ip.as_deref(), Some("93.184.216.34"));
        assert_eq!(dst.port, Some(443));

        let ci = event.connection_info.as_ref().unwrap();
        assert_eq!(ci.protocol_name.as_deref(), Some("TCP"));
        assert_eq!(ci.protocol_num, Some(6));
        assert_eq!(ci.direction_id, Some(2)); // Outbound

        let json_val = serde_json::to_value(&event).unwrap();
        let errors = validate_ocsf_json(&json_val);
        assert!(errors.is_empty(), "validation errors: {:?}", errors);
    }

    #[test]
    fn dropped_flow() {
        let fact = json!({
            "verdict": "DROPPED",
            "traffic_direction": "INGRESS",
            "summary": "blocked connection"
        });

        let event = hubble_fact_to_network_activity(&fact, 0, "0.1.3").unwrap();
        assert_eq!(event.type_uid, 400105); // Refuse
        assert_eq!(event.status_id, 2); // Failure
        assert_eq!(event.action_id, Some(2)); // Denied
    }

    #[test]
    fn forwarded_flow_with_flat_l4_schema() {
        let fact = json!({
            "verdict": "FORWARDED",
            "traffic_direction": "EGRESS",
            "summary": "TCP 10.0.0.1:8080 -> 93.184.216.34:443",
            "ip": {
                "source": "10.0.0.1",
                "destination": "93.184.216.34"
            },
            "l4": {
                "protocol": "TCP",
                "source_port": 8080,
                "destination_port": 443
            }
        });

        let event = hubble_fact_to_network_activity(&fact, 1_709_366_400_000, "0.1.3").unwrap();
        let src = event.src_endpoint.as_ref().unwrap();
        let dst = event.dst_endpoint.as_ref().unwrap();
        let ci = event.connection_info.as_ref().unwrap();

        assert_eq!(src.port, Some(8080));
        assert_eq!(dst.port, Some(443));
        assert_eq!(ci.protocol_name.as_deref(), Some("TCP"));
        assert_eq!(ci.protocol_num, Some(6));
    }

    #[test]
    fn error_flow() {
        let fact = json!({
            "verdict": "ERROR",
            "summary": "connection error"
        });

        let event = hubble_fact_to_network_activity(&fact, 0, "0.1.3").unwrap();
        assert_eq!(event.type_uid, 400104); // Fail
    }

    #[test]
    fn missing_verdict_returns_none() {
        let fact = json!({
            "summary": "some flow"
        });
        assert!(hubble_fact_to_network_activity(&fact, 0, "0.1.3").is_none());
    }
}
