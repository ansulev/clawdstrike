//! Runtime validation of OCSF required fields on serialized JSON.
//!
//! Intended for integration tests and debug builds. Production code uses
//! the typed structs which enforce required fields at compile time.

use serde_json::Value;

/// Errors found during OCSF field validation.
#[derive(Clone, Debug, thiserror::Error)]
pub enum OcsfValidationError {
    /// A required field is missing.
    #[error("missing required OCSF field: {field}")]
    MissingField { field: &'static str },
    /// A field has an unexpected type.
    #[error("invalid type for OCSF field {field}: expected {expected}")]
    InvalidType {
        field: &'static str,
        expected: &'static str,
    },
    /// The type_uid does not match class_uid * 100 + activity_id.
    #[error("type_uid mismatch: expected {expected}, got {actual}")]
    TypeUidMismatch { expected: u64, actual: u64 },
    /// Severity ID out of range.
    #[error("severity_id {value} is not a valid OCSF severity (0-6, 99)")]
    InvalidSeverity { value: u64 },
}

/// Validate that a serialized OCSF event JSON contains all required base fields.
///
/// Returns a list of all validation errors found (empty = valid).
#[must_use]
pub fn validate_ocsf_json(json: &Value) -> Vec<OcsfValidationError> {
    let mut errors = Vec::new();

    // Required numeric fields
    let class_uid = check_u64(json, "class_uid", &mut errors);
    let activity_id = check_u64(json, "activity_id", &mut errors);
    let type_uid = check_u64(json, "type_uid", &mut errors);
    check_u64(json, "severity_id", &mut errors);
    check_u64(json, "status_id", &mut errors);

    // Required field: time (epoch ms)
    check_i64(json, "time", &mut errors);

    // Required field: category_uid
    check_u64(json, "category_uid", &mut errors);

    // Metadata
    if let Some(metadata) = json.get("metadata") {
        if metadata.get("version").and_then(|v| v.as_str()).is_none() {
            errors.push(OcsfValidationError::MissingField {
                field: "metadata.version",
            });
        }
        if metadata.get("product").is_none() {
            errors.push(OcsfValidationError::MissingField {
                field: "metadata.product",
            });
        } else {
            let product = &metadata["product"];
            if product.get("name").and_then(|v| v.as_str()).is_none() {
                errors.push(OcsfValidationError::MissingField {
                    field: "metadata.product.name",
                });
            }
            if product
                .get("vendor_name")
                .and_then(|v| v.as_str())
                .is_none()
            {
                errors.push(OcsfValidationError::MissingField {
                    field: "metadata.product.vendor_name",
                });
            }
        }
    } else {
        errors.push(OcsfValidationError::MissingField { field: "metadata" });
    }

    // type_uid invariant
    if let (Some(c), Some(a), Some(t)) = (class_uid, activity_id, type_uid) {
        let expected = c * 100 + a;
        if t != expected {
            errors.push(OcsfValidationError::TypeUidMismatch {
                expected,
                actual: t,
            });
        }
    }

    // severity_id range check
    if let Some(sev) = json.get("severity_id").and_then(|v| v.as_u64()) {
        if sev > 6 && sev != 99 {
            errors.push(OcsfValidationError::InvalidSeverity { value: sev });
        }
    }

    // Detection Finding-specific: finding_info
    if let Some(class) = class_uid {
        if class == 2004 {
            validate_detection_finding(json, &mut errors);
        }
    }

    errors
}

fn validate_detection_finding(json: &Value, errors: &mut Vec<OcsfValidationError>) {
    if let Some(fi) = json.get("finding_info") {
        if fi.get("uid").and_then(|v| v.as_str()).is_none() {
            errors.push(OcsfValidationError::MissingField {
                field: "finding_info.uid",
            });
        }
        if fi.get("title").and_then(|v| v.as_str()).is_none() {
            errors.push(OcsfValidationError::MissingField {
                field: "finding_info.title",
            });
        }
        if fi.get("analytic").is_none() {
            errors.push(OcsfValidationError::MissingField {
                field: "finding_info.analytic",
            });
        }
    } else {
        errors.push(OcsfValidationError::MissingField {
            field: "finding_info",
        });
    }

    // action_id and disposition_id are required for Detection Finding
    check_u64(json, "action_id", errors);
    check_u64(json, "disposition_id", errors);
}

fn check_u64(
    json: &Value,
    field: &'static str,
    errors: &mut Vec<OcsfValidationError>,
) -> Option<u64> {
    match json.get(field) {
        Some(v) => match v.as_u64() {
            Some(n) => Some(n),
            None => {
                errors.push(OcsfValidationError::InvalidType {
                    field,
                    expected: "unsigned integer",
                });
                None
            }
        },
        None => {
            errors.push(OcsfValidationError::MissingField { field });
            None
        }
    }
}

fn check_i64(
    json: &Value,
    field: &'static str,
    errors: &mut Vec<OcsfValidationError>,
) -> Option<i64> {
    match json.get(field) {
        Some(v) => match v.as_i64() {
            Some(n) => Some(n),
            None => {
                errors.push(OcsfValidationError::InvalidType {
                    field,
                    expected: "integer",
                });
                None
            }
        },
        None => {
            errors.push(OcsfValidationError::MissingField { field });
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn valid_detection_finding() -> Value {
        json!({
            "class_uid": 2004,
            "category_uid": 2,
            "type_uid": 200401,
            "activity_id": 1,
            "time": 1709366400000_i64,
            "severity_id": 4,
            "status_id": 2,
            "action_id": 2,
            "disposition_id": 2,
            "metadata": {
                "version": "1.4.0",
                "product": {
                    "name": "ClawdStrike",
                    "uid": "clawdstrike",
                    "vendor_name": "Backbay Labs",
                    "version": "0.1.3"
                }
            },
            "finding_info": {
                "uid": "finding-001",
                "title": "Forbidden path",
                "analytic": {
                    "name": "ForbiddenPathGuard",
                    "type_id": 1,
                    "type": "Rule"
                }
            }
        })
    }

    #[test]
    fn valid_event_passes() {
        let errors = validate_ocsf_json(&valid_detection_finding());
        assert!(errors.is_empty(), "unexpected errors: {:?}", errors);
    }

    #[test]
    fn missing_class_uid() {
        let mut v = valid_detection_finding();
        v.as_object_mut().unwrap().remove("class_uid");
        let errors = validate_ocsf_json(&v);
        assert!(errors
            .iter()
            .any(|e| matches!(e, OcsfValidationError::MissingField { field: "class_uid" })));
    }

    #[test]
    fn wrong_type_uid() {
        let mut v = valid_detection_finding();
        v["type_uid"] = json!(999999);
        let errors = validate_ocsf_json(&v);
        assert!(errors
            .iter()
            .any(|e| matches!(e, OcsfValidationError::TypeUidMismatch { .. })));
    }

    #[test]
    fn invalid_severity() {
        let mut v = valid_detection_finding();
        v["severity_id"] = json!(7);
        let errors = validate_ocsf_json(&v);
        assert!(errors
            .iter()
            .any(|e| matches!(e, OcsfValidationError::InvalidSeverity { value: 7 })));
    }

    #[test]
    fn severity_99_is_valid() {
        let mut v = valid_detection_finding();
        v["severity_id"] = json!(99);
        let errors = validate_ocsf_json(&v);
        assert!(!errors
            .iter()
            .any(|e| matches!(e, OcsfValidationError::InvalidSeverity { .. })));
    }

    #[test]
    fn missing_metadata() {
        let mut v = valid_detection_finding();
        v.as_object_mut().unwrap().remove("metadata");
        let errors = validate_ocsf_json(&v);
        assert!(errors
            .iter()
            .any(|e| matches!(e, OcsfValidationError::MissingField { field: "metadata" })));
    }

    #[test]
    fn missing_finding_info_for_2004() {
        let mut v = valid_detection_finding();
        v.as_object_mut().unwrap().remove("finding_info");
        let errors = validate_ocsf_json(&v);
        assert!(errors.iter().any(|e| matches!(
            e,
            OcsfValidationError::MissingField {
                field: "finding_info"
            }
        )));
    }

    #[test]
    fn non_detection_finding_needs_no_finding_info() {
        let v = json!({
            "class_uid": 1007,
            "category_uid": 1,
            "type_uid": 100701,
            "activity_id": 1,
            "time": 1709366400000_i64,
            "severity_id": 1,
            "status_id": 1,
            "metadata": {
                "version": "1.4.0",
                "product": {
                    "name": "ClawdStrike",
                    "uid": "clawdstrike",
                    "vendor_name": "Backbay Labs",
                    "version": "0.1.3"
                }
            }
        });
        let errors = validate_ocsf_json(&v);
        assert!(errors.is_empty(), "unexpected errors: {:?}", errors);
    }
}
