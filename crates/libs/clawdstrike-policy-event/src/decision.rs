//! Shared helpers for decision metadata parsing across converters.

/// Extract the `allowed` flag from a decision object.
pub(crate) fn decision_allowed(
    decision_obj: &serde_json::Map<String, serde_json::Value>,
) -> Option<bool> {
    decision_obj.get("allowed").and_then(|v| v.as_bool())
}

/// Determine whether a structured decision object should be treated as a warning.
pub(crate) fn decision_object_is_warn(
    decision_obj: &serde_json::Map<String, serde_json::Value>,
) -> bool {
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
            .map(|s| s.to_lowercase()),
        Some(v) if matches!(v.as_str(), "warn" | "warning" | "warned" | "logged")
    ) {
        return true;
    }

    matches!(
        decision_obj
            .get("severity")
            .and_then(severity_from_value)
            .map(|s| s.to_lowercase()),
        Some(v) if matches!(v.as_str(), "warn" | "warning")
    )
}

/// Extract a severity string from either a plain string or a nested object.
pub(crate) fn severity_from_value(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) => Some(s.to_string()),
        serde_json::Value::Object(obj) => obj
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
    fn decision_field_warn_string_is_treated_as_warn() {
        let decision_obj = json!({
            "decision": "warn"
        })
        .as_object()
        .cloned()
        .expect("object");

        assert!(decision_object_is_warn(&decision_obj));
    }
}
