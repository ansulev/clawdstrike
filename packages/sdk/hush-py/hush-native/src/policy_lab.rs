//! PyO3 bindings for PolicyLab operations.

use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;

/// Python wrapper around `clawdstrike_policy_event::facade::PolicyLabHandle`.
#[pyclass(name = "PolicyLab")]
pub struct PolicyLab {
    inner: clawdstrike_policy_event::facade::PolicyLabHandle,
}

#[pymethods]
impl PolicyLab {
    /// Create a new PolicyLab handle from a policy YAML string.
    #[new]
    #[pyo3(signature = (policy_yaml,))]
    fn new(policy_yaml: &str) -> PyResult<Self> {
        let inner = clawdstrike_policy_event::facade::PolicyLabHandle::new(policy_yaml)
            .map_err(|e| PyValueError::new_err(e.to_string()))?;
        Ok(Self { inner })
    }

    /// Synthesize a policy from observed events (JSONL string).
    ///
    /// Returns a Python dict with `policy_yaml` and `risks`.
    #[staticmethod]
    #[pyo3(signature = (events_jsonl,))]
    fn synth(py: Python<'_>, events_jsonl: &str) -> PyResult<Py<PyAny>> {
        let result = clawdstrike_policy_event::facade::PolicyLabHandle::synth(events_jsonl)
            .map_err(|e| PyValueError::new_err(e.to_string()))?;
        let v = serde_json::to_value(&result)
            .map_err(|e| PyValueError::new_err(format!("Failed to serialize result: {}", e)))?;
        super::json_value_to_py(py, &v)
    }

    /// Simulate events (JSONL string) against the loaded policy.
    ///
    /// Returns a Python dict with `summary` and `results`.
    #[pyo3(signature = (events_jsonl,))]
    fn simulate(&self, py: Python<'_>, events_jsonl: &str) -> PyResult<Py<PyAny>> {
        let result = self
            .inner
            .simulate(events_jsonl)
            .map_err(|e| PyValueError::new_err(e.to_string()))?;
        let v = serde_json::to_value(&result)
            .map_err(|e| PyValueError::new_err(format!("Failed to serialize result: {}", e)))?;
        super::json_value_to_py(py, &v)
    }

    /// Convert events JSONL to OCSF JSONL string.
    #[staticmethod]
    #[pyo3(signature = (events_jsonl,))]
    fn to_ocsf(events_jsonl: &str) -> PyResult<String> {
        clawdstrike_policy_event::facade::PolicyLabHandle::to_ocsf(events_jsonl)
            .map_err(|e| PyValueError::new_err(e.to_string()))
    }

    /// Convert events JSONL to timeline JSONL string.
    #[staticmethod]
    #[pyo3(signature = (events_jsonl,))]
    fn to_timeline(events_jsonl: &str) -> PyResult<String> {
        clawdstrike_policy_event::facade::PolicyLabHandle::to_timeline(events_jsonl)
            .map_err(|e| PyValueError::new_err(e.to_string()))
    }
}
