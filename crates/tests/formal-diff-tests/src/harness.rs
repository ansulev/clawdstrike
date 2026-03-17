//! Differential test harness utilities.
//!
//! Provides structured failure reporting for differential tests where
//! a reference specification is compared against the production implementation.

use std::fmt;

/// A single differential test failure.
#[derive(Debug)]
pub struct DiffFailure {
    /// Debug representation of the input that caused the mismatch.
    pub input: String,
    /// Output from the reference specification.
    pub spec_output: String,
    /// Output from the production implementation.
    pub impl_output: String,
}

impl fmt::Display for DiffFailure {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "  Input:     {}", self.input)?;
        writeln!(f, "  Spec:      {}", self.spec_output)?;
        writeln!(f, "  Impl:      {}", self.impl_output)?;
        Ok(())
    }
}

/// Accumulated results of a differential test run.
#[derive(Debug)]
pub struct DiffTestResult {
    /// Name of the test.
    pub test_name: String,
    /// Total number of test cases executed.
    pub total: usize,
    /// Number of test cases that passed.
    pub passed: usize,
    /// Number of test cases that failed.
    pub failed: usize,
    /// Details of each failure.
    pub failures: Vec<DiffFailure>,
}

impl DiffTestResult {
    /// Create a new empty result set.
    #[must_use]
    pub fn new(test_name: impl Into<String>) -> Self {
        Self {
            test_name: test_name.into(),
            total: 0,
            passed: 0,
            failed: 0,
            failures: Vec::new(),
        }
    }

    /// Record a passing test case.
    pub fn record_pass(&mut self) {
        self.total += 1;
        self.passed += 1;
    }

    /// Record a failing test case.
    pub fn record_fail(&mut self, input: String, spec_output: String, impl_output: String) {
        self.total += 1;
        self.failed += 1;
        self.failures.push(DiffFailure {
            input,
            spec_output,
            impl_output,
        });
    }

    /// Assert that all tests passed (panics with details if any failed).
    pub fn assert_all_passed(&self) {
        if self.failed > 0 {
            let mut msg = format!(
                "Differential test '{}' FAILED: {}/{} cases\n",
                self.test_name, self.failed, self.total
            );
            for (i, f) in self.failures.iter().enumerate() {
                msg.push_str(&format!("Failure #{}:\n{}\n", i + 1, f));
            }
            panic!("{}", msg);
        }
    }
}

// ---------------------------------------------------------------------------
// Conversion helpers: translate between spec and impl types for comparison
// ---------------------------------------------------------------------------

use crate::spec::{CycleCheckSpec, SpecSeverity, SpecVerdict};
use clawdstrike::core::{CoreSeverity, CoreVerdict, CycleCheckResult};

/// Convert a `CoreSeverity` to a `SpecSeverity` for comparison.
#[must_use]
pub fn core_sev_to_spec(s: CoreSeverity) -> SpecSeverity {
    match s {
        CoreSeverity::Info => SpecSeverity::Info,
        CoreSeverity::Warning => SpecSeverity::Warning,
        CoreSeverity::Error => SpecSeverity::Error,
        CoreSeverity::Critical => SpecSeverity::Critical,
    }
}

/// Convert a `SpecSeverity` to a `CoreSeverity`.
#[must_use]
pub fn spec_sev_to_core(s: SpecSeverity) -> CoreSeverity {
    match s {
        SpecSeverity::Info => CoreSeverity::Info,
        SpecSeverity::Warning => CoreSeverity::Warning,
        SpecSeverity::Error => CoreSeverity::Error,
        SpecSeverity::Critical => CoreSeverity::Critical,
    }
}

/// Compare a spec verdict with a core verdict on the fields that matter.
///
/// Returns `true` if `allowed`, `severity`, and `sanitized` all match.
#[must_use]
pub fn verdicts_match(spec: &SpecVerdict, core: &CoreVerdict) -> bool {
    spec.allowed == core.allowed
        && core_sev_to_spec(core.severity) == spec.severity
        && spec.sanitized == core.sanitized
}

/// Compare a spec cycle-check result with a core cycle-check result.
#[must_use]
pub fn cycle_results_match(spec: &CycleCheckSpec, core: &CycleCheckResult) -> bool {
    match (spec, core) {
        (CycleCheckSpec::Ok, CycleCheckResult::Ok) => true,
        (
            CycleCheckSpec::DepthExceeded {
                depth: sd,
                limit: sl,
            },
            CycleCheckResult::DepthExceeded {
                depth: cd,
                limit: cl,
            },
        ) => sd == cd && sl == cl,
        (
            CycleCheckSpec::CycleDetected { key: sk },
            CycleCheckResult::CycleDetected { key: ck },
        ) => sk == ck,
        _ => false,
    }
}
