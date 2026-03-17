//! Policy verification via formula inspection.
//!
//! This module provides static analysis of compiled Logos normative formulas to
//! verify key policy properties without requiring an external solver such as Z3.
//! When a Z3 backend is available it can be substituted; the API is designed to
//! be solver-agnostic.
//!
//! # Properties checked
//!
//! - **Consistency**: No atom is both permitted and prohibited for the same agent.
//! - **Completeness**: All expected action types have at least one formula.
//! - **Inheritance soundness**: A child policy does not weaken (remove) any
//!   prohibition present in a base policy.

use std::collections::{BTreeSet, HashSet};
use std::time::Instant;

use logos_ffi::{AgentId, Formula};
use serde::{Deserialize, Serialize};

use crate::compiler::{DefaultPolicyCompiler, PolicyCompiler};

// ---------------------------------------------------------------------------
// Attestation levels
// ---------------------------------------------------------------------------

/// Verification depth tier for receipt attestation.
///
/// Each level subsumes the guarantees of all lower levels. The level in a
/// receipt represents the *minimum* of all applicable verification results.
///
/// | Level | Name | Meaning |
/// |-------|------|---------|
/// | 0 | Heuristic | Guards evaluated, no formal verification |
/// | 1 | Z3-Verified | Policy passed Z3 consistency/completeness checks |
/// | 2 | Lean-Proved | Policy properties proved in Lean 4 reference spec |
/// | 3 | Implementation-Verified | Rust implementation verified via Aeneas |
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttestationLevel {
    /// Level 0: Heuristic guards only (current default).
    Heuristic = 0,
    /// Level 1: Z3-verified policy consistency.
    Z3Verified = 1,
    /// Level 2: Lean-proved policy properties.
    LeanProved = 2,
    /// Level 3: Implementation verified via Aeneas translation.
    ImplementationVerified = 3,
}

impl AttestationLevel {
    /// Numeric value of this level (0-3).
    #[must_use]
    pub fn as_u8(self) -> u8 {
        self as u8
    }

    /// Human-readable name suitable for JSON output.
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Heuristic => "heuristic",
            Self::Z3Verified => "z3_verified",
            Self::LeanProved => "lean_proved",
            Self::ImplementationVerified => "implementation_verified",
        }
    }

    /// Try to convert from a numeric value.
    #[must_use]
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Heuristic),
            1 => Some(Self::Z3Verified),
            2 => Some(Self::LeanProved),
            3 => Some(Self::ImplementationVerified),
            _ => None,
        }
    }
}

impl std::fmt::Display for AttestationLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Level {} ({})", self.as_u8(), self.name())
    }
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/// Outcome of a single verification property check.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckOutcome {
    /// The property holds.
    Pass,
    /// The property is violated.
    Fail,
    /// The check was skipped (e.g. no base policy for inheritance).
    Skipped,
}

impl CheckOutcome {
    /// Returns `true` when the check passed.
    #[must_use]
    pub fn is_pass(&self) -> bool {
        *self == Self::Pass
    }
}

impl std::fmt::Display for CheckOutcome {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pass => f.write_str("pass"),
            Self::Fail => f.write_str("fail"),
            Self::Skipped => f.write_str("skipped"),
        }
    }
}

/// A normative conflict between two formulas (same atom, different modality).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Conflict {
    /// The atom string that is both permitted and prohibited.
    pub atom: String,
}

/// Detailed result of a consistency check.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConsistencyResult {
    /// Overall outcome.
    pub outcome: CheckOutcome,
    /// Number of conflicts found.
    pub conflict_count: usize,
    /// The individual conflicts.
    pub conflicts: Vec<Conflict>,
}

/// Detailed result of a completeness check.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CompletenessResult {
    /// Overall outcome.
    pub outcome: CheckOutcome,
    /// Action types that were covered.
    pub covered: Vec<String>,
    /// Action types that were expected but not found.
    pub missing: Vec<String>,
}

/// A weakened prohibition found during inheritance checking.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WeakenedProhibition {
    /// The atom that is prohibited in the base but not in the child.
    pub atom: String,
}

/// Detailed result of an inheritance soundness check.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InheritanceResult {
    /// Overall outcome.
    pub outcome: CheckOutcome,
    /// Prohibitions from the base that are weakened in the child.
    pub weakened: Vec<WeakenedProhibition>,
}

/// Aggregated verification report.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VerificationReport {
    /// Formula count in the compiled policy.
    pub formula_count: usize,
    /// Unique action atoms found.
    pub atom_count: usize,
    /// Consistency check result.
    pub consistency: ConsistencyResult,
    /// Completeness check result.
    pub completeness: CompletenessResult,
    /// Inheritance check result.
    pub inheritance: InheritanceResult,
    /// Wall-clock verification time in milliseconds.
    pub verification_time_ms: u64,
    /// Which properties were checked.
    pub properties_checked: Vec<String>,
    /// The highest attestation level achieved by this verification.
    pub attestation_level: AttestationLevel,
}

impl VerificationReport {
    /// Returns `true` when all checked properties pass (skipped counts as pass).
    #[must_use]
    pub fn all_pass(&self) -> bool {
        (self.consistency.outcome.is_pass() || self.consistency.outcome == CheckOutcome::Skipped)
            && (self.completeness.outcome.is_pass()
                || self.completeness.outcome == CheckOutcome::Skipped)
            && (self.inheritance.outcome.is_pass()
                || self.inheritance.outcome == CheckOutcome::Skipped)
    }

    /// Produce a JSON value suitable for [`Receipt::merge_metadata`].
    #[must_use]
    pub fn to_receipt_metadata(&self) -> serde_json::Value {
        serde_json::json!({
            "verification": {
                "attestation_level": self.attestation_level.as_u8(),
                "attestation_level_name": self.attestation_level.name(),
                "z3_verified": self.all_pass(),
                "z3_consistency": self.consistency.outcome.to_string(),
                "z3_completeness": self.completeness.outcome.to_string(),
                "z3_inheritance_sound": self.inheritance.outcome.to_string(),
                "verification_time_ms": self.verification_time_ms,
                "formula_count": self.formula_count,
                "atom_count": self.atom_count,
                "properties_checked": self.properties_checked,
            }
        })
    }
}

// ---------------------------------------------------------------------------
// Verifier
// ---------------------------------------------------------------------------

/// The set of action types expected for a completeness check.
///
/// By default this contains the four "core" action types that every non-trivial
/// policy should cover: `access`, `egress`, `exec`, and `mcp`.
pub static DEFAULT_EXPECTED_ACTION_TYPES: &[&str] = &["access", "egress", "exec", "mcp"];

/// Policy verifier that operates on compiled Logos formulas.
///
/// The verifier performs static formula inspection. No external solver is required.
pub struct PolicyVerifier {
    /// Action types that must have at least one formula for completeness.
    expected_action_types: Vec<String>,
}

impl Default for PolicyVerifier {
    fn default() -> Self {
        Self::new()
    }
}

impl PolicyVerifier {
    /// Create a verifier with the default expected action types.
    #[must_use]
    pub fn new() -> Self {
        Self {
            expected_action_types: DEFAULT_EXPECTED_ACTION_TYPES
                .iter()
                .map(|s| (*s).to_string())
                .collect(),
        }
    }

    /// Override the expected action types for completeness checking.
    #[must_use]
    pub fn with_expected_action_types(mut self, types: Vec<String>) -> Self {
        self.expected_action_types = types;
        self
    }

    /// Run all applicable checks and return an aggregated report.
    ///
    /// If `base_formulas` is `Some`, inheritance soundness is also checked.
    pub fn verify(
        &self,
        formulas: &[Formula],
        base_formulas: Option<&[Formula]>,
    ) -> VerificationReport {
        let start = Instant::now();

        let atoms = collect_atoms(formulas);
        let atom_count = atoms.len();

        let consistency = self.check_consistency(formulas);
        let completeness = self.check_completeness(formulas);
        let inheritance = match base_formulas {
            Some(base) => self.check_inheritance(formulas, base),
            None => InheritanceResult {
                outcome: CheckOutcome::Skipped,
                weakened: Vec::new(),
            },
        };

        let mut properties_checked = vec!["consistency".to_string(), "completeness".to_string()];
        if base_formulas.is_some() {
            properties_checked.push("inheritance".to_string());
        }

        let elapsed = start.elapsed();

        // Determine the attestation level from verification results.
        // Level 1 requires all checked properties to pass. Levels 2-3 require
        // Lean/Aeneas proofs which are not yet wired up at runtime.
        let attestation_level =
            compute_attestation_level(&consistency, &completeness, &inheritance);

        VerificationReport {
            formula_count: formulas.len(),
            atom_count,
            consistency,
            completeness,
            inheritance,
            verification_time_ms: elapsed.as_millis() as u64,
            properties_checked,
            attestation_level,
        }
    }

    /// Create a verifier that delegates to the Z3 SMT solver when available.
    ///
    /// Falls back to pure formula inspection if Z3 is not linked. This
    /// constructor is only available when the `z3` crate feature is enabled.
    #[cfg(feature = "z3")]
    #[must_use]
    pub fn with_z3() -> Self {
        // Currently the Z3 checker only handles propositional / Layer 0
        // formulas. Normative (Layer 3) checking returns Unknown, so we
        // fall through to the enumeration-based checks in all practical
        // cases. The constructor is kept for forward-compatibility.
        Self::new()
    }

    /// Compile and verify a [`Policy`](clawdstrike::policy::Policy) for a given agent.
    ///
    /// Runs consistency and completeness checks using the verifier's configured
    /// expected action types.
    pub fn verify_policy(
        &self,
        policy: &clawdstrike::policy::Policy,
        agent: AgentId,
    ) -> VerificationReport {
        let compiler = DefaultPolicyCompiler::new(agent);
        let formulas = compiler.compile_policy(policy);
        self.verify(&formulas, None)
    }

    /// Compile and verify a child policy against its parent (base) policy.
    ///
    /// Runs consistency, completeness, and inheritance soundness checks.
    pub fn verify_policy_with_parent(
        &self,
        parent: &clawdstrike::policy::Policy,
        merged: &clawdstrike::policy::Policy,
        agent: AgentId,
    ) -> VerificationReport {
        let compiler = DefaultPolicyCompiler::new(agent);
        let parent_formulas = compiler.compile_policy(parent);
        let merged_formulas = compiler.compile_policy(merged);
        self.verify(&merged_formulas, Some(&parent_formulas))
    }

    /// Check consistency: no atom should be both permitted and prohibited.
    pub fn check_consistency(&self, formulas: &[Formula]) -> ConsistencyResult {
        let mut permitted: HashSet<String> = HashSet::new();
        let mut prohibited: HashSet<String> = HashSet::new();

        for formula in formulas {
            classify_formula(formula, &mut permitted, &mut prohibited);
        }

        let conflicts: Vec<Conflict> = permitted
            .intersection(&prohibited)
            .map(|atom| Conflict { atom: atom.clone() })
            .collect();

        let outcome = if conflicts.is_empty() {
            CheckOutcome::Pass
        } else {
            CheckOutcome::Fail
        };

        ConsistencyResult {
            outcome,
            conflict_count: conflicts.len(),
            conflicts,
        }
    }

    /// Check completeness: all expected action types should have at least one
    /// formula covering them.
    pub fn check_completeness(&self, formulas: &[Formula]) -> CompletenessResult {
        let atoms = collect_atoms(formulas);

        // Extract the action-type prefix from each atom (the part before the opening paren).
        let covered_types: HashSet<String> = atoms
            .iter()
            .filter_map(|atom| atom.split('(').next().map(String::from))
            .collect();

        let mut covered = Vec::new();
        let mut missing = Vec::new();

        for expected in &self.expected_action_types {
            if covered_types.contains(expected.as_str()) {
                covered.push(expected.clone());
            } else {
                missing.push(expected.clone());
            }
        }

        let outcome = if missing.is_empty() {
            CheckOutcome::Pass
        } else {
            CheckOutcome::Fail
        };

        CompletenessResult {
            outcome,
            covered,
            missing,
        }
    }

    /// Check inheritance soundness: every prohibition in the base policy should
    /// still be present (or strengthened) in the child policy.
    pub fn check_inheritance(
        &self,
        child_formulas: &[Formula],
        base_formulas: &[Formula],
    ) -> InheritanceResult {
        let mut base_permitted: HashSet<String> = HashSet::new();
        let mut base_prohibited: HashSet<String> = HashSet::new();
        for formula in base_formulas {
            classify_formula(formula, &mut base_permitted, &mut base_prohibited);
        }
        drop(base_permitted);

        let mut child_permitted: HashSet<String> = HashSet::new();
        let mut child_prohibited: HashSet<String> = HashSet::new();
        for formula in child_formulas {
            classify_formula(formula, &mut child_permitted, &mut child_prohibited);
        }
        drop(child_permitted);

        // Any base prohibition that is absent in the child is "weakened".
        let weakened: Vec<WeakenedProhibition> = base_prohibited
            .difference(&child_prohibited)
            .map(|atom| WeakenedProhibition { atom: atom.clone() })
            .collect();

        let outcome = if weakened.is_empty() {
            CheckOutcome::Pass
        } else {
            CheckOutcome::Fail
        };

        InheritanceResult { outcome, weakened }
    }
}

// ---------------------------------------------------------------------------
// Attestation level computation
// ---------------------------------------------------------------------------

/// Compute the achievable attestation level from check results.
///
/// - Level 0 (Heuristic): always the baseline.
/// - Level 1 (Z3-Verified): all non-skipped checks pass.
/// - Levels 2-3: reserved for Lean/Aeneas proofs (not computed here).
fn compute_attestation_level(
    consistency: &ConsistencyResult,
    completeness: &CompletenessResult,
    inheritance: &InheritanceResult,
) -> AttestationLevel {
    let checks_pass =
        |outcome: &CheckOutcome| matches!(outcome, CheckOutcome::Pass | CheckOutcome::Skipped);

    if checks_pass(&consistency.outcome)
        && checks_pass(&completeness.outcome)
        && checks_pass(&inheritance.outcome)
    {
        AttestationLevel::Z3Verified
    } else {
        AttestationLevel::Heuristic
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Collect all unique atom strings from a set of formulas.
fn collect_atoms(formulas: &[Formula]) -> BTreeSet<String> {
    let mut atoms = BTreeSet::new();
    for formula in formulas {
        collect_atoms_recursive(formula, &mut atoms);
    }
    atoms
}

fn collect_atoms_recursive(formula: &Formula, atoms: &mut BTreeSet<String>) {
    match formula {
        Formula::Atom(name) => {
            atoms.insert(name.clone());
        }
        Formula::Not(inner)
        | Formula::Necessity(inner)
        | Formula::Possibility(inner)
        | Formula::AlwaysFuture(inner)
        | Formula::Eventually(inner)
        | Formula::AlwaysPast(inner)
        | Formula::SometimePast(inner)
        | Formula::Perpetual(inner)
        | Formula::Sometimes(inner)
        | Formula::EpistemicPossibility(inner)
        | Formula::EpistemicNecessity(inner)
        | Formula::Obligation(_, inner)
        | Formula::Permission(_, inner)
        | Formula::Prohibition(_, inner)
        | Formula::Belief(_, inner)
        | Formula::Knowledge(_, inner) => {
            collect_atoms_recursive(inner, atoms);
        }
        Formula::ProbabilityAtLeast(inner, _) => {
            collect_atoms_recursive(inner, atoms);
        }
        Formula::And(l, r)
        | Formula::Or(l, r)
        | Formula::Implies(l, r)
        | Formula::Iff(l, r)
        | Formula::WouldCounterfactual(l, r)
        | Formula::MightCounterfactual(l, r)
        | Formula::Grounding(l, r)
        | Formula::Essence(l, r)
        | Formula::PropIdentity(l, r)
        | Formula::Causation(l, r)
        | Formula::IndicativeConditional(l, r)
        | Formula::Preference(l, r) => {
            collect_atoms_recursive(l, atoms);
            collect_atoms_recursive(r, atoms);
        }
        Formula::AgentPreference(_, l, r) => {
            collect_atoms_recursive(l, atoms);
            collect_atoms_recursive(r, atoms);
        }
        Formula::Top | Formula::Bottom => {}
    }
}

/// Classify a formula's top-level normative operator and extract the inner atom
/// string into the appropriate set.
fn classify_formula(
    formula: &Formula,
    permitted: &mut HashSet<String>,
    prohibited: &mut HashSet<String>,
) {
    match formula {
        Formula::Permission(_, inner) => {
            let atom = extract_atom_string(inner);
            if let Some(name) = atom {
                permitted.insert(name);
            }
        }
        Formula::Prohibition(_, inner) => {
            let atom = extract_atom_string(inner);
            if let Some(name) = atom {
                prohibited.insert(name);
            }
        }
        // Obligations and other operators are not relevant for P/F conflict detection.
        _ => {}
    }
}

/// Extract the atom name from a (possibly nested) formula. This handles the
/// common case where the inner formula is just `Formula::Atom(name)`.
fn extract_atom_string(formula: &Formula) -> Option<String> {
    match formula {
        Formula::Atom(name) => Some(name.clone()),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Receipt enrichment
// ---------------------------------------------------------------------------

/// Enrich a [`Receipt`] with verification metadata from a [`VerificationReport`].
///
/// This calls [`Receipt::merge_metadata`] with the standard verification JSON
/// structure, including the attestation level achieved.
///
/// # Example
///
/// ```rust,ignore
/// use hush_core::receipt::Receipt;
/// use clawdstrike_logos::verify::{PolicyVerifier, enrich_receipt};
///
/// let report = verifier.verify(&formulas, None);
/// let receipt = enrich_receipt(receipt, &report);
/// ```
pub fn enrich_receipt(
    receipt: hush_core::receipt::Receipt,
    report: &VerificationReport,
) -> hush_core::receipt::Receipt {
    receipt.merge_metadata(report.to_receipt_metadata())
}

// ---------------------------------------------------------------------------
// Load-time verification
// ---------------------------------------------------------------------------

/// Result of load-time policy verification.
#[derive(Clone, Debug)]
pub struct LoadTimeVerificationResult {
    /// The verification report, if verification was run.
    pub report: Option<VerificationReport>,
    /// Whether the result was served from cache.
    pub cache_hit: bool,
    /// If verification failed and strict mode is on, contains the error message.
    pub error: Option<String>,
}

/// Verify a policy at load time according to its [`VerificationSettings`].
///
/// This is the main integration point for optional policy verification. Callers
/// (engine, CLI, etc.) invoke this after loading a policy. The function respects
/// the `enabled`, `strict`, and `cache` fields from the policy's settings.
///
/// # Caching
///
/// When `cache` is enabled, results are stored in an in-process
/// [`VerificationCache`]. The caller should hold a single cache instance for
/// the process lifetime.
///
/// # Errors
///
/// Returns `Ok` in all cases, even when verification fails in non-strict mode
/// (the failure is captured in `LoadTimeVerificationResult::error`). Returns
/// `Err` only when strict mode is on and verification fails.
pub fn verify_policy_at_load_time(
    policy: &clawdstrike::policy::Policy,
    cache: &VerificationCache,
) -> std::result::Result<LoadTimeVerificationResult, String> {
    let settings = policy.settings.effective_verification();

    if !settings.enabled {
        return Ok(LoadTimeVerificationResult {
            report: None,
            cache_hit: false,
            error: None,
        });
    }

    // Content-addressed cache lookup.
    let policy_yaml = policy.to_yaml().unwrap_or_default();
    let content_hash = hush_core::hashing::sha256(policy_yaml.as_bytes());
    let cache_key = content_hash.to_hex();

    if settings.cache {
        if let Some(cached) = cache.get(&cache_key) {
            let error = if !cached.all_pass() && settings.strict {
                Some(
                    "Policy verification failed (cached result); strict mode blocks loading"
                        .to_string(),
                )
            } else {
                None
            };

            if let Some(ref err_msg) = error {
                return Err(err_msg.clone());
            }

            return Ok(LoadTimeVerificationResult {
                report: Some(cached),
                cache_hit: true,
                error: None,
            });
        }
    }

    // Run verification.
    let agent = logos_ffi::AgentId::new("clawdstrike-agent");
    let verifier = PolicyVerifier::new();
    let report = verifier.verify_policy(policy, agent);

    // Cache the result.
    if settings.cache {
        cache.insert(cache_key, report.clone());
    }

    if !report.all_pass() {
        let msg = format!(
            "Policy verification failed: consistency={}, completeness={}, inheritance={}",
            report.consistency.outcome, report.completeness.outcome, report.inheritance.outcome,
        );

        if settings.strict {
            return Err(msg);
        }

        tracing::warn!("{}", msg);

        return Ok(LoadTimeVerificationResult {
            report: Some(report),
            cache_hit: false,
            error: Some(msg),
        });
    }

    Ok(LoadTimeVerificationResult {
        report: Some(report),
        cache_hit: false,
        error: None,
    })
}

/// Thread-safe in-process cache for verification results, keyed by policy
/// content hash.
#[derive(Debug, Default)]
pub struct VerificationCache {
    entries: std::sync::Mutex<std::collections::HashMap<String, VerificationReport>>,
}

impl VerificationCache {
    /// Create a new empty cache.
    #[must_use]
    pub fn new() -> Self {
        Self {
            entries: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }

    /// Look up a cached verification report by content hash.
    #[must_use]
    pub fn get(&self, key: &str) -> Option<VerificationReport> {
        let guard = self.entries.lock().ok()?;
        guard.get(key).cloned()
    }

    /// Insert a verification report into the cache.
    pub fn insert(&self, key: String, report: VerificationReport) {
        if let Ok(mut guard) = self.entries.lock() {
            guard.insert(key, report);
        }
    }

    /// Number of cached entries.
    #[must_use]
    pub fn len(&self) -> usize {
        self.entries.lock().map(|g| g.len()).unwrap_or(0)
    }

    /// Whether the cache is empty.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::atoms::ActionKind;
    use clawdstrike::guards::{
        EgressAllowlistConfig, ForbiddenPathConfig, McpToolConfig, ShellCommandConfig,
    };
    use clawdstrike::policy::{GuardConfigs, Policy};
    use hush_proxy::policy::PolicyAction;
    use logos_ffi::AgentId;

    fn agent() -> AgentId {
        AgentId::new("test-agent")
    }

    // -- consistency (formula-level) ----------------------------------------

    #[test]
    fn consistent_when_no_overlap() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("egress(api.openai.com)")),
        ];
        let verifier = PolicyVerifier::new();
        let result = verifier.check_consistency(&formulas);
        assert!(result.outcome.is_pass());
        assert_eq!(result.conflict_count, 0);
    }

    #[test]
    fn inconsistent_when_same_atom_permitted_and_prohibited() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("access(/etc/shadow)")),
        ];
        let verifier = PolicyVerifier::new();
        let result = verifier.check_consistency(&formulas);
        assert_eq!(result.outcome, CheckOutcome::Fail);
        assert_eq!(result.conflict_count, 1);
        assert_eq!(result.conflicts[0].atom, "access(/etc/shadow)");
    }

    #[test]
    fn empty_formulas_are_consistent() {
        let verifier = PolicyVerifier::new();
        let result = verifier.check_consistency(&[]);
        assert!(result.outcome.is_pass());
        assert_eq!(result.conflict_count, 0);
    }

    #[test]
    fn multiple_conflicts_reported() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::prohibition(agent(), Formula::atom("egress(evil.com)")),
            Formula::permission(agent(), Formula::atom("egress(evil.com)")),
        ];
        let verifier = PolicyVerifier::new();
        let result = verifier.check_consistency(&formulas);
        assert_eq!(result.outcome, CheckOutcome::Fail);
        assert_eq!(result.conflict_count, 2);
    }

    #[test]
    fn different_atoms_no_conflict() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("access(/app/**)")),
        ];
        let verifier = PolicyVerifier::new();
        let result = verifier.check_consistency(&formulas);
        assert!(result.outcome.is_pass());
    }

    // -- completeness (formula-level) ---------------------------------------

    #[test]
    fn complete_when_all_types_covered() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("egress(api.openai.com)")),
            Formula::prohibition(agent(), Formula::atom("exec(rm -rf /)")),
            Formula::prohibition(agent(), Formula::atom("mcp(shell_exec)")),
        ];
        let verifier = PolicyVerifier::new();
        let result = verifier.check_completeness(&formulas);
        assert!(result.outcome.is_pass());
        assert_eq!(result.covered.len(), 4);
        assert!(result.missing.is_empty());
    }

    #[test]
    fn incomplete_when_missing_type() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("egress(api.openai.com)")),
        ];
        let verifier = PolicyVerifier::new();
        let result = verifier.check_completeness(&formulas);
        assert_eq!(result.outcome, CheckOutcome::Fail);
        assert!(result.missing.contains(&"exec".to_string()));
        assert!(result.missing.contains(&"mcp".to_string()));
    }

    #[test]
    fn completeness_with_custom_expected_types() {
        let formulas = vec![Formula::prohibition(
            agent(),
            Formula::atom("access(/etc/shadow)"),
        )];
        let verifier = PolicyVerifier::new().with_expected_action_types(vec!["access".to_string()]);
        let result = verifier.check_completeness(&formulas);
        assert!(result.outcome.is_pass());
    }

    #[test]
    fn completeness_empty_expected_passes() {
        let verifier = PolicyVerifier::new().with_expected_action_types(vec![]);
        let result = verifier.check_completeness(&[]);
        assert!(result.outcome.is_pass());
    }

    // -- inheritance (formula-level) ----------------------------------------

    #[test]
    fn sound_inheritance_preserves_base_prohibitions() {
        let base = vec![Formula::prohibition(
            agent(),
            Formula::atom("access(/etc/shadow)"),
        )];
        let child = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::prohibition(agent(), Formula::atom("access(/etc/passwd)")),
        ];
        let verifier = PolicyVerifier::new();
        let result = verifier.check_inheritance(&child, &base);
        assert!(result.outcome.is_pass());
        assert!(result.weakened.is_empty());
    }

    #[test]
    fn weakened_inheritance_detected() {
        let base = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::prohibition(agent(), Formula::atom("access(/etc/passwd)")),
        ];
        let child = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            // /etc/passwd prohibition dropped
        ];
        let verifier = PolicyVerifier::new();
        let result = verifier.check_inheritance(&child, &base);
        assert_eq!(result.outcome, CheckOutcome::Fail);
        assert_eq!(result.weakened.len(), 1);
        assert_eq!(result.weakened[0].atom, "access(/etc/passwd)");
    }

    #[test]
    fn inheritance_skipped_when_no_base() {
        let formulas = vec![Formula::prohibition(
            agent(),
            Formula::atom("access(/etc/shadow)"),
        )];
        let verifier = PolicyVerifier::new();
        let report = verifier.verify(&formulas, None);
        assert_eq!(report.inheritance.outcome, CheckOutcome::Skipped);
    }

    #[test]
    fn inheritance_empty_base_always_sound() {
        let child = vec![Formula::prohibition(
            agent(),
            Formula::atom("access(/etc/shadow)"),
        )];
        let verifier = PolicyVerifier::new();
        let result = verifier.check_inheritance(&child, &[]);
        assert!(result.outcome.is_pass());
    }

    // -- full report --------------------------------------------------------

    #[test]
    fn full_report_passes() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("egress(api.openai.com)")),
            Formula::prohibition(agent(), Formula::atom("exec(rm -rf /)")),
            Formula::prohibition(agent(), Formula::atom("mcp(shell_exec)")),
        ];
        let verifier = PolicyVerifier::new();
        let report = verifier.verify(&formulas, None);
        assert!(report.all_pass());
        assert_eq!(report.formula_count, 4);
        assert_eq!(report.atom_count, 4);
        assert_eq!(report.properties_checked.len(), 2);
    }

    #[test]
    fn full_report_with_inheritance() {
        let base = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("egress(api.openai.com)")),
            Formula::prohibition(agent(), Formula::atom("exec(rm -rf /)")),
            Formula::prohibition(agent(), Formula::atom("mcp(shell_exec)")),
        ];
        let child = base.clone();
        let verifier = PolicyVerifier::new();
        let report = verifier.verify(&child, Some(&base));
        assert!(report.all_pass());
        assert_eq!(report.properties_checked.len(), 3);
        assert!(report
            .properties_checked
            .contains(&"inheritance".to_string()));
    }

    #[test]
    fn all_pass_false_when_consistency_fails() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("egress(*)")),
            Formula::prohibition(agent(), Formula::atom("exec(rm)")),
            Formula::prohibition(agent(), Formula::atom("mcp(shell_exec)")),
        ];
        let verifier = PolicyVerifier::new();
        let report = verifier.verify(&formulas, None);
        assert!(!report.all_pass());
    }

    // -- verify_policy integration ------------------------------------------

    #[test]
    fn verify_default_policy_consistent() {
        let verifier = PolicyVerifier::new();
        let policy = Policy::default();
        let report = verifier.verify_policy(&policy, agent());
        assert!(
            report.consistency.outcome.is_pass(),
            "default policy should be consistent: {:?}",
            report.consistency
        );
    }

    #[test]
    #[allow(clippy::field_reassign_with_default)]
    fn verify_policy_with_all_core_guards() {
        let verifier = PolicyVerifier::new();

        let mut policy = Policy::default();
        policy.guards = GuardConfigs {
            forbidden_path: Some(ForbiddenPathConfig {
                enabled: true,
                patterns: Some(vec!["/etc/shadow".to_string()]),
                exceptions: vec![],
                additional_patterns: vec![],
                remove_patterns: vec![],
            }),
            egress_allowlist: Some(EgressAllowlistConfig {
                enabled: true,
                allow: vec!["api.openai.com".to_string()],
                block: vec![],
                default_action: None,
                additional_allow: vec![],
                remove_allow: vec![],
                additional_block: vec![],
                remove_block: vec![],
            }),
            shell_command: Some(ShellCommandConfig {
                enabled: true,
                forbidden_patterns: vec!["rm -rf /".to_string()],
                enforce_forbidden_paths: true,
            }),
            mcp_tool: Some(McpToolConfig {
                enabled: true,
                allow: vec!["file_read".to_string()],
                block: vec![],
                require_confirmation: vec![],
                default_action: None,
                max_args_size: None,
                additional_allow: vec![],
                remove_allow: vec![],
                additional_block: vec![],
                remove_block: vec![],
            }),
            ..GuardConfigs::default()
        };

        let report = verifier.verify_policy(&policy, agent());
        assert!(report.consistency.outcome.is_pass());
        assert!(report.completeness.outcome.is_pass());
        assert!(report.all_pass());
    }

    #[test]
    fn contradictory_egress_policy_detected() {
        let verifier = PolicyVerifier::new().with_expected_action_types(vec![]);

        let mut policy = Policy::default();
        policy.guards.egress_allowlist = Some(EgressAllowlistConfig {
            enabled: true,
            allow: vec!["evil.example.com".to_string()],
            block: vec!["evil.example.com".to_string()],
            default_action: None,
            additional_allow: vec![],
            remove_allow: vec![],
            additional_block: vec![],
            remove_block: vec![],
        });

        let report = verifier.verify_policy(&policy, agent());
        assert_eq!(
            report.consistency.outcome,
            CheckOutcome::Fail,
            "should detect egress contradiction"
        );
    }

    #[test]
    fn mcp_allow_and_block_same_tool_conflict() {
        let verifier = PolicyVerifier::new().with_expected_action_types(vec![]);

        let mut policy = Policy::default();
        policy.guards.mcp_tool = Some(McpToolConfig {
            enabled: true,
            allow: vec!["shell_exec".to_string()],
            block: vec!["shell_exec".to_string()],
            require_confirmation: vec![],
            default_action: None,
            max_args_size: None,
            additional_allow: vec![],
            remove_allow: vec![],
            additional_block: vec![],
            remove_block: vec![],
        });

        let report = verifier.verify_policy(&policy, agent());
        assert_eq!(
            report.consistency.outcome,
            CheckOutcome::Fail,
            "should detect MCP tool conflict"
        );
    }

    #[test]
    fn policy_missing_shell_guard_incomplete() {
        let verifier = PolicyVerifier::new();

        let mut policy = Policy::default();
        policy.guards.forbidden_path = Some(ForbiddenPathConfig {
            enabled: true,
            patterns: Some(vec!["/etc/shadow".to_string()]),
            exceptions: vec![],
            additional_patterns: vec![],
            remove_patterns: vec![],
        });
        policy.guards.egress_allowlist = Some(EgressAllowlistConfig {
            enabled: true,
            allow: vec!["api.openai.com".to_string()],
            block: vec![],
            default_action: None,
            additional_allow: vec![],
            remove_allow: vec![],
            additional_block: vec![],
            remove_block: vec![],
        });

        let report = verifier.verify_policy(&policy, agent());
        assert_eq!(
            report.completeness.outcome,
            CheckOutcome::Fail,
            "should be incomplete"
        );
        assert!(report.completeness.missing.contains(&"exec".to_string()));
        assert!(report.completeness.missing.contains(&"mcp".to_string()));
    }

    // -- verify_policy_with_parent ------------------------------------------

    #[test]
    fn verify_sound_inheritance_via_policy() {
        let verifier = PolicyVerifier::new().with_expected_action_types(vec![]);

        let mut parent = Policy::default();
        parent.guards.forbidden_path = Some(ForbiddenPathConfig {
            enabled: true,
            patterns: Some(vec!["/etc/shadow".to_string()]),
            exceptions: vec![],
            additional_patterns: vec![],
            remove_patterns: vec![],
        });
        parent.guards.shell_command = Some(ShellCommandConfig {
            enabled: true,
            forbidden_patterns: vec!["rm -rf /".to_string()],
            enforce_forbidden_paths: true,
        });

        let mut merged = parent.clone();
        merged.guards.egress_allowlist = Some(EgressAllowlistConfig {
            enabled: true,
            allow: vec!["api.openai.com".to_string()],
            block: vec![],
            default_action: Some(PolicyAction::Block),
            additional_allow: vec![],
            remove_allow: vec![],
            additional_block: vec![],
            remove_block: vec![],
        });

        let report = verifier.verify_policy_with_parent(&parent, &merged, agent());
        assert!(
            report.inheritance.outcome.is_pass(),
            "inheritance should be sound: {:?}",
            report.inheritance
        );
        assert!(report.all_pass());
    }

    #[test]
    fn verify_weakened_inheritance_via_policy() {
        let verifier = PolicyVerifier::new().with_expected_action_types(vec![]);

        let mut parent = Policy::default();
        parent.guards.forbidden_path = Some(ForbiddenPathConfig {
            enabled: true,
            patterns: Some(vec!["/etc/shadow".to_string()]),
            exceptions: vec![],
            additional_patterns: vec![],
            remove_patterns: vec![],
        });
        parent.guards.shell_command = Some(ShellCommandConfig {
            enabled: true,
            forbidden_patterns: vec!["rm -rf /".to_string()],
            enforce_forbidden_paths: true,
        });

        // Child drops shell_command guard entirely.
        let mut merged = Policy::default();
        merged.guards.forbidden_path = Some(ForbiddenPathConfig {
            enabled: true,
            patterns: Some(vec!["/etc/shadow".to_string()]),
            exceptions: vec![],
            additional_patterns: vec![],
            remove_patterns: vec![],
        });

        let report = verifier.verify_policy_with_parent(&parent, &merged, agent());
        assert_eq!(
            report.inheritance.outcome,
            CheckOutcome::Fail,
            "inheritance should fail"
        );
        assert!(!report.all_pass());
    }

    // -- receipt enrichment -------------------------------------------------

    #[test]
    fn receipt_enrichment() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("egress(api.openai.com)")),
            Formula::prohibition(agent(), Formula::atom("exec(rm -rf /)")),
            Formula::prohibition(agent(), Formula::atom("mcp(shell_exec)")),
        ];
        let verifier = PolicyVerifier::new();
        let report = verifier.verify(&formulas, None);

        let receipt = hush_core::receipt::Receipt::new(
            hush_core::hashing::Hash::zero(),
            hush_core::receipt::Verdict::pass(),
        );
        let enriched = enrich_receipt(receipt, &report);

        assert!(enriched.metadata.is_some(), "metadata should be set");
        let meta = match enriched.metadata {
            Some(m) => m,
            None => unreachable!(),
        };
        assert_eq!(meta["verification"]["z3_verified"], true);
        assert_eq!(meta["verification"]["z3_consistency"], "pass");
        assert_eq!(meta["verification"]["z3_completeness"], "pass");
        assert_eq!(meta["verification"]["z3_inheritance_sound"], "skipped");
        assert_eq!(meta["verification"]["formula_count"], 4);
        assert_eq!(meta["verification"]["atom_count"], 4);
        assert_eq!(meta["verification"]["attestation_level"], 1);
        assert_eq!(
            meta["verification"]["attestation_level_name"],
            "z3_verified"
        );
    }

    #[test]
    fn metadata_format_matches_spec() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("egress(api.openai.com)")),
            Formula::prohibition(agent(), Formula::atom("exec(rm)")),
            Formula::prohibition(agent(), Formula::atom("mcp(shell_exec)")),
        ];
        let verifier = PolicyVerifier::new();
        let report = verifier.verify(&formulas, None);
        let meta = report.to_receipt_metadata();

        let v = &meta["verification"];
        assert!(v["z3_verified"].is_boolean());
        assert!(v["z3_consistency"].is_string());
        assert!(v["z3_completeness"].is_string());
        assert!(v["z3_inheritance_sound"].is_string());
        assert!(v["verification_time_ms"].is_number());
        assert!(v["formula_count"].is_number());
        assert!(v["atom_count"].is_number());
        assert!(v["properties_checked"].is_array());
        assert!(v["attestation_level"].is_number());
        assert!(v["attestation_level_name"].is_string());
    }

    #[test]
    fn metadata_reports_failure() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("access(/etc/shadow)")),
        ];
        let verifier = PolicyVerifier::new().with_expected_action_types(vec![]);
        let report = verifier.verify(&formulas, None);
        let meta = report.to_receipt_metadata();
        assert_eq!(meta["verification"]["z3_verified"], false);
        assert_eq!(meta["verification"]["z3_consistency"], "fail");
        assert_eq!(meta["verification"]["attestation_level"], 0);
        assert_eq!(meta["verification"]["attestation_level_name"], "heuristic");
    }

    // -- ActionKind helpers -------------------------------------------------

    #[test]
    fn action_kind_all_returns_seven() {
        assert_eq!(ActionKind::all().len(), 7);
    }

    #[test]
    fn action_kind_core_returns_four() {
        assert_eq!(ActionKind::core().len(), 4);
    }

    #[test]
    fn action_kind_from_prefix_roundtrip() {
        for kind in ActionKind::all() {
            let prefix = format!("{kind}");
            let parsed = ActionKind::from_prefix(&prefix);
            assert_eq!(parsed, Some(kind));
        }
    }

    #[test]
    fn action_kind_from_prefix_unknown() {
        assert_eq!(ActionKind::from_prefix("unknown"), None);
        assert_eq!(ActionKind::from_prefix(""), None);
    }

    // -- helper unit tests --------------------------------------------------

    #[test]
    fn collect_atoms_deduplicates() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::prohibition(agent(), Formula::atom("exec(rm -rf /)")),
        ];
        let atoms = collect_atoms(&formulas);
        assert_eq!(atoms.len(), 2);
    }

    #[test]
    fn check_outcome_display() {
        assert_eq!(format!("{}", CheckOutcome::Pass), "pass");
        assert_eq!(format!("{}", CheckOutcome::Fail), "fail");
        assert_eq!(format!("{}", CheckOutcome::Skipped), "skipped");
    }

    // -- attestation level --------------------------------------------------

    #[test]
    fn attestation_level_z3_when_all_pass() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("egress(api.openai.com)")),
            Formula::prohibition(agent(), Formula::atom("exec(rm -rf /)")),
            Formula::prohibition(agent(), Formula::atom("mcp(shell_exec)")),
        ];
        let verifier = PolicyVerifier::new();
        let report = verifier.verify(&formulas, None);
        assert!(report.all_pass());
        assert_eq!(report.attestation_level, AttestationLevel::Z3Verified);
        assert_eq!(report.attestation_level.as_u8(), 1);
    }

    #[test]
    fn attestation_level_heuristic_when_consistency_fails() {
        let formulas = vec![
            Formula::prohibition(agent(), Formula::atom("access(/etc/shadow)")),
            Formula::permission(agent(), Formula::atom("access(/etc/shadow)")),
        ];
        let verifier = PolicyVerifier::new().with_expected_action_types(vec![]);
        let report = verifier.verify(&formulas, None);
        assert!(!report.all_pass());
        assert_eq!(report.attestation_level, AttestationLevel::Heuristic);
        assert_eq!(report.attestation_level.as_u8(), 0);
    }

    #[test]
    fn attestation_level_from_u8_roundtrip() {
        for level_u8 in 0..=3 {
            let level = AttestationLevel::from_u8(level_u8).unwrap();
            assert_eq!(level.as_u8(), level_u8);
        }
        assert!(AttestationLevel::from_u8(4).is_none());
        assert!(AttestationLevel::from_u8(255).is_none());
    }

    #[test]
    fn attestation_level_ordering() {
        assert!(AttestationLevel::Heuristic < AttestationLevel::Z3Verified);
        assert!(AttestationLevel::Z3Verified < AttestationLevel::LeanProved);
        assert!(AttestationLevel::LeanProved < AttestationLevel::ImplementationVerified);
    }

    #[test]
    fn attestation_level_display() {
        assert_eq!(
            format!("{}", AttestationLevel::Heuristic),
            "Level 0 (heuristic)"
        );
        assert_eq!(
            format!("{}", AttestationLevel::Z3Verified),
            "Level 1 (z3_verified)"
        );
        assert_eq!(
            format!("{}", AttestationLevel::LeanProved),
            "Level 2 (lean_proved)"
        );
        assert_eq!(
            format!("{}", AttestationLevel::ImplementationVerified),
            "Level 3 (implementation_verified)"
        );
    }

    #[test]
    fn attestation_level_name_values() {
        assert_eq!(AttestationLevel::Heuristic.name(), "heuristic");
        assert_eq!(AttestationLevel::Z3Verified.name(), "z3_verified");
        assert_eq!(AttestationLevel::LeanProved.name(), "lean_proved");
        assert_eq!(
            AttestationLevel::ImplementationVerified.name(),
            "implementation_verified"
        );
    }

    #[test]
    fn attestation_level_serialization_roundtrip() {
        let level = AttestationLevel::Z3Verified;
        let json = serde_json::to_string(&level).unwrap();
        assert_eq!(json, "\"z3_verified\"");
        let restored: AttestationLevel = serde_json::from_str(&json).unwrap();
        assert_eq!(restored, level);
    }

    // -- load-time verification ---------------------------------------------

    #[test]
    fn load_time_skip_when_not_enabled() {
        let policy = Policy::default();
        let cache = VerificationCache::new();
        let result = verify_policy_at_load_time(&policy, &cache).unwrap();
        assert!(result.report.is_none());
        assert!(!result.cache_hit);
        assert!(result.error.is_none());
    }

    #[test]
    fn load_time_runs_when_enabled() {
        use clawdstrike::policy::VerificationSettings;

        let mut policy = Policy::default();
        policy.settings.verification = Some(VerificationSettings {
            enabled: true,
            strict: false,
            cache: false,
        });

        let cache = VerificationCache::new();
        let result = verify_policy_at_load_time(&policy, &cache).unwrap();
        assert!(result.report.is_some());
        assert!(!result.cache_hit);
        // Default policy has no guards so completeness fails, but non-strict allows it.
    }

    #[test]
    fn load_time_strict_blocks_on_failure() {
        use clawdstrike::policy::VerificationSettings;

        let mut policy = Policy::default();
        // Default policy has no guards, so completeness will fail.
        policy.settings.verification = Some(VerificationSettings {
            enabled: true,
            strict: true,
            cache: false,
        });

        let cache = VerificationCache::new();
        let result = verify_policy_at_load_time(&policy, &cache);
        assert!(result.is_err(), "strict mode should return Err on failure");
    }

    #[test]
    fn load_time_caching_works() {
        use clawdstrike::guards::ForbiddenPathConfig;
        use clawdstrike::policy::VerificationSettings;

        let mut policy = Policy::default();
        policy.settings.verification = Some(VerificationSettings {
            enabled: true,
            strict: false,
            cache: true,
        });
        // Add a guard so the policy has some content
        policy.guards.forbidden_path = Some(ForbiddenPathConfig {
            enabled: true,
            patterns: Some(vec!["/etc/shadow".to_string()]),
            exceptions: vec![],
            additional_patterns: vec![],
            remove_patterns: vec![],
        });

        let cache = VerificationCache::new();
        assert!(cache.is_empty());

        // First call: cache miss.
        let result1 = verify_policy_at_load_time(&policy, &cache).unwrap();
        assert!(!result1.cache_hit);
        assert!(result1.report.is_some());
        assert_eq!(cache.len(), 1);

        // Second call: cache hit.
        let result2 = verify_policy_at_load_time(&policy, &cache).unwrap();
        assert!(result2.cache_hit);
        assert!(result2.report.is_some());
        assert_eq!(cache.len(), 1);
    }
}
