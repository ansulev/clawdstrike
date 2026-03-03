//! Golden fixture comparison tests.
//!
//! These tests verify that the OCSF output from converters matches the expected
//! golden fixture files. Non-deterministic fields (time, uid) are checked for
//! type correctness rather than exact value.

use clawdstrike_ocsf::convert::from_guard_result::{
    guard_result_to_detection_finding, GuardResultInput,
};
use clawdstrike_ocsf::convert::from_security_event::{security_event_to_ocsf, SecurityEventInput};
use clawdstrike_ocsf::validate::validate_ocsf_json;

fn load_fixture(name: &str) -> serde_json::Value {
    let path = format!(
        "{}/fixtures/ocsf/{name}",
        env!("CARGO_MANIFEST_DIR").replace("/crates/libs/clawdstrike-ocsf", "")
    );
    let content = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("failed to read fixture {path}: {e}"));
    serde_json::from_str(&content).unwrap_or_else(|e| panic!("failed to parse fixture {path}: {e}"))
}

/// Check that schema-level fields match between actual and expected.
fn assert_schema_fields_match(actual: &serde_json::Value, expected: &serde_json::Value) {
    let fields = [
        "class_uid",
        "category_uid",
        "type_uid",
        "activity_id",
        "severity_id",
        "status_id",
        "action_id",
        "disposition_id",
    ];

    for field in fields {
        assert_eq!(
            actual.get(field),
            expected.get(field),
            "field {field} mismatch: actual={:?}, expected={:?}",
            actual.get(field),
            expected.get(field)
        );
    }

    // Check metadata fields
    assert_eq!(
        actual["metadata"]["version"], expected["metadata"]["version"],
        "metadata.version mismatch"
    );
    assert_eq!(
        actual["metadata"]["product"]["name"], expected["metadata"]["product"]["name"],
        "metadata.product.name mismatch"
    );
    assert_eq!(
        actual["metadata"]["product"]["vendor_name"],
        expected["metadata"]["product"]["vendor_name"],
        "metadata.product.vendor_name mismatch"
    );
}

#[test]
fn golden_detection_finding_allow() {
    let expected = load_fixture("detection_finding_allow.json");

    let input = SecurityEventInput {
        event_id: "evt-allow-001",
        time_ms: 1_709_366_400_000,
        allowed: true,
        outcome: "success",
        severity: "info",
        guard: "EgressAllowlistGuard",
        reason: "Allowed",
        product_version: "0.1.3",
        action: "egress",
        resource_type: "network",
        resource_name: "api.example.com",
        resource_path: None,
        resource_host: Some("api.example.com"),
        resource_port: Some(443),
        agent_id: "agent-1",
        agent_name: "test-agent",
        session_id: Some("sess-1"),
    };

    let result = security_event_to_ocsf(&input);
    let actual = serde_json::to_value(&result.detection_finding).unwrap();

    // Validate OCSF compliance
    let errors = validate_ocsf_json(&actual);
    assert!(errors.is_empty(), "OCSF validation errors: {:?}", errors);

    // Check schema-level fields match
    assert_schema_fields_match(&actual, &expected);

    // Finding info analytic type must be Rule (1)
    assert_eq!(actual["finding_info"]["analytic"]["type_id"], 1);
}

#[test]
fn golden_detection_finding_deny() {
    let expected = load_fixture("detection_finding_deny.json");

    let input = SecurityEventInput {
        event_id: "evt-deny-001",
        time_ms: 1_709_366_400_000,
        allowed: false,
        outcome: "failure",
        severity: "critical",
        guard: "ForbiddenPathGuard",
        reason: "Blocked access to /etc/shadow",
        product_version: "0.1.3",
        action: "file_access",
        resource_type: "file",
        resource_name: "/etc/shadow",
        resource_path: Some("/etc/shadow"),
        resource_host: None,
        resource_port: None,
        agent_id: "agent-1",
        agent_name: "test-agent",
        session_id: Some("sess-1"),
    };

    let result = security_event_to_ocsf(&input);
    let actual = serde_json::to_value(&result.detection_finding).unwrap();

    // Validate OCSF compliance
    let errors = validate_ocsf_json(&actual);
    assert!(errors.is_empty(), "OCSF validation errors: {:?}", errors);

    // Schema-level fields
    assert_schema_fields_match(&actual, &expected);

    // Critical severity must be 5, not 6
    assert_eq!(actual["severity_id"], 5);
    assert_ne!(actual["severity_id"], 6);
}

#[test]
fn golden_process_activity_exec() {
    let fixture = load_fixture("process_activity_exec.json");
    let errors = validate_ocsf_json(&fixture);
    assert!(errors.is_empty(), "fixture validation errors: {:?}", errors);
    assert_eq!(fixture["class_uid"], 1007);
    assert_eq!(fixture["type_uid"], 100701);
}

#[test]
fn golden_network_activity_egress() {
    let fixture = load_fixture("network_activity_egress.json");
    let errors = validate_ocsf_json(&fixture);
    assert!(errors.is_empty(), "fixture validation errors: {:?}", errors);
    assert_eq!(fixture["class_uid"], 4001);
    assert_eq!(fixture["type_uid"], 400106);
}

#[test]
fn golden_file_activity_write() {
    let fixture = load_fixture("file_activity_write.json");
    let errors = validate_ocsf_json(&fixture);
    assert!(errors.is_empty(), "fixture validation errors: {:?}", errors);
    assert_eq!(fixture["class_uid"], 1001);
    assert_eq!(fixture["type_uid"], 100103);
}

#[test]
fn all_guard_names_produce_valid_ocsf() {
    let guards = [
        "ForbiddenPathGuard",
        "PathAllowlistGuard",
        "EgressAllowlistGuard",
        "SecretLeakGuard",
        "PatchIntegrityGuard",
        "ShellCommandGuard",
        "McpToolGuard",
        "PromptInjectionGuard",
        "JailbreakGuard",
        "ComputerUseGuard",
        "RemoteDesktopSideChannelGuard",
        "InputInjectionCapabilityGuard",
    ];

    for guard in guards {
        let input = GuardResultInput {
            allowed: false,
            guard,
            severity: "high",
            message: &format!("{guard} blocked action"),
            time_ms: 1_709_366_400_000,
            event_uid: &format!("evt-{guard}"),
            product_version: "0.1.3",
            resource_name: Some("/test/path"),
            resource_type: Some("file"),
        };

        let finding = guard_result_to_detection_finding(&input);
        let json = serde_json::to_value(&finding).unwrap();
        let errors = validate_ocsf_json(&json);
        assert!(
            errors.is_empty(),
            "OCSF validation errors for guard {guard}: {:?}",
            errors
        );
        assert_eq!(json["class_uid"], 2004, "guard {guard} wrong class_uid");
        assert_eq!(
            json["finding_info"]["analytic"]["type_id"], 1,
            "guard {guard} analytic should be Rule"
        );
    }
}
