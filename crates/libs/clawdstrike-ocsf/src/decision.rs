//! Shared decision-object parsing helpers used by OCSF converters.

use serde_json::Value;

/// Extract the effective `allowed` flag from a decision object.
///
/// Supports canonical aliases used in receipts and bridge metadata.
#[must_use]
pub fn decision_object_allowed(decision_obj: &serde_json::Map<String, Value>) -> Option<bool> {
    decision_obj
        .get("allowed")
        .and_then(|v| v.as_bool())
        .or_else(|| decision_obj.get("passed").and_then(|v| v.as_bool()))
        .or_else(|| {
            decision_obj
                .get("denied")
                .and_then(|v| v.as_bool())
                .map(|v| !v)
        })
        .or_else(|| {
            decision_obj
                .get("blocked")
                .and_then(|v| v.as_bool())
                .map(|v| !v)
        })
}

/// Determine whether a structured decision object should be treated as a warning.
#[must_use]
pub fn decision_object_is_warn(decision_obj: &serde_json::Map<String, Value>) -> bool {
    if decision_obj
        .get("warn")
        .or_else(|| decision_obj.get("warning"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return true;
    }

    if matches!(
        decision_obj
            .get("verdict")
            .or_else(|| decision_obj.get("decision"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_ascii_lowercase()),
        Some(v) if matches!(v.as_str(), "warn" | "warning" | "warned" | "logged")
    ) {
        return true;
    }

    matches!(
        decision_obj
            .get("severity")
            .and_then(severity_from_value)
            .map(|s| s.to_ascii_lowercase()),
        Some(v) if matches!(v.as_str(), "warn" | "warning")
    )
}

/// Extract a severity string from either a plain string or nested object forms.
#[must_use]
pub fn severity_from_value(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.to_string()),
        Value::Object(obj) => obj
            .get("level")
            .or_else(|| obj.get("name"))
            .or_else(|| obj.get("value"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn allowed_aliases_are_supported() {
        let passed = json!({ "passed": false }).as_object().cloned().unwrap();
        assert_eq!(decision_object_allowed(&passed), Some(false));

        let denied = json!({ "denied": true }).as_object().cloned().unwrap();
        assert_eq!(decision_object_allowed(&denied), Some(false));

        let blocked = json!({ "blocked": false }).as_object().cloned().unwrap();
        assert_eq!(decision_object_allowed(&blocked), Some(true));
    }

    #[test]
    fn decision_field_warn_string_is_treated_as_warn() {
        let decision_obj = json!({ "decision": "warn" }).as_object().cloned().unwrap();
        assert!(decision_object_is_warn(&decision_obj));
    }
}
