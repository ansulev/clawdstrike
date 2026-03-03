//! Property-based tests for OCSF types.

use proptest::prelude::*;

use clawdstrike_ocsf::base::{compute_type_uid, SeverityId};
use clawdstrike_ocsf::convert::from_guard_result::{
    guard_result_to_detection_finding, GuardResultInput,
};
use clawdstrike_ocsf::severity::map_severity;
use clawdstrike_ocsf::validate::validate_ocsf_json;

/// Severity mapping is idempotent: mapping a label back produces the same SeverityId.
#[test]
fn severity_mapping_roundtrip() {
    let cases: &[(&str, SeverityId)] = &[
        ("info", SeverityId::Informational),
        ("low", SeverityId::Low),
        ("medium", SeverityId::Medium),
        ("high", SeverityId::High),
        ("critical", SeverityId::Critical),
        ("fatal", SeverityId::Fatal),
    ];

    for &(input, expected) in cases {
        let result = map_severity(input);
        assert_eq!(result, expected, "severity mismatch for {input}");
        // Roundtrip via label
        let label = result.label();
        let result2 = map_severity(label);
        assert_eq!(result, result2, "roundtrip failed for {input} -> {label}");
    }
}

// type_uid formula holds for all valid class_uid / activity_id combos.
proptest! {
    #[test]
    fn type_uid_formula_holds(class_uid in 0u16..10000, activity_id in 0u8..100) {
        let type_uid = compute_type_uid(class_uid, activity_id);
        let expected = (class_uid as u32) * 100 + (activity_id as u32);
        prop_assert_eq!(type_uid, expected);
    }
}

/// All class/activity combinations defined in the plan produce correct type_uid.
#[test]
fn all_class_activity_combos() {
    let combos: &[(u16, u8, u32)] = &[
        // Detection Finding
        (2004, 1, 200401), // Create
        (2004, 2, 200402), // Update
        (2004, 3, 200403), // Close
        // Process Activity
        (1007, 1, 100701), // Launch
        (1007, 2, 100702), // Terminate
        (1007, 3, 100703), // Open
        (1007, 4, 100704), // Inject
        (1007, 5, 100705), // SetUserId
        // File Activity
        (1001, 1, 100101),  // Create
        (1001, 2, 100102),  // Read
        (1001, 3, 100103),  // Update
        (1001, 4, 100104),  // Delete
        (1001, 14, 100114), // Open
        // Network Activity
        (4001, 1, 400101), // Open
        (4001, 2, 400102), // Close
        (4001, 3, 400103), // Reset
        (4001, 4, 400104), // Fail
        (4001, 5, 400105), // Refuse
        (4001, 6, 400106), // Traffic
    ];

    for &(class_uid, activity_id, expected) in combos {
        assert_eq!(
            compute_type_uid(class_uid, activity_id),
            expected,
            "type_uid mismatch for class={class_uid} activity={activity_id}"
        );
    }
}

// Generated guard results always produce valid OCSF.
proptest! {
    #[test]
    fn guard_result_always_valid_ocsf(
        allowed in any::<bool>(),
        severity_idx in 0usize..5,
    ) {
        let severities = ["info", "low", "medium", "high", "critical"];
        let severity = severities[severity_idx];

        let input = GuardResultInput {
            allowed,
            guard: "TestGuard",
            severity,
            message: "test message",
            time_ms: 1_709_366_400_000,
            event_uid: "test-evt",
            product_version: "0.1.3",
            resource_name: Some("/test"),
            resource_type: Some("file"),
        };

        let finding = guard_result_to_detection_finding(&input);
        let json = serde_json::to_value(&finding).unwrap();
        let errors = validate_ocsf_json(&json);
        prop_assert!(errors.is_empty(), "validation errors: {:?}", errors);

        // type_uid invariant
        let class_uid = json["class_uid"].as_u64().unwrap();
        let activity_id = json["activity_id"].as_u64().unwrap();
        let type_uid = json["type_uid"].as_u64().unwrap();
        prop_assert_eq!(type_uid, class_uid * 100 + activity_id);

        // Critical must map to 5
        if severity == "critical" {
            prop_assert_eq!(json["severity_id"].as_u64().unwrap(), 5);
        }
    }
}
