//! Integration tests that load built-in ClawdStrike rulesets and verify their
//! normative properties via the Logos formula verifier.
//!
//! Every built-in ruleset should pass consistency and completeness checks.

use clawdstrike::policy::RuleSet;
use clawdstrike_logos::compiler::{DefaultPolicyCompiler, PolicyCompiler};
use clawdstrike_logos::logos_ffi::AgentId;
use clawdstrike_logos::verifier::PolicyVerifier;

fn agent() -> AgentId {
    AgentId::new("integration-test-agent")
}

/// Helper: load a built-in ruleset by name, compile to formulas, and run
/// verification. Panics on any non-pass result for consistency/completeness.
fn verify_builtin(name: &str) {
    let ruleset = match RuleSet::by_name(name) {
        Ok(Some(rs)) => rs,
        Ok(None) => panic!("no such ruleset: {name}"),
        Err(e) => panic!("failed to load ruleset '{name}': {e}"),
    };

    let compiler = DefaultPolicyCompiler::new(agent());
    let formulas = compiler.compile_policy(&ruleset.policy);

    // All built-in rulesets should produce at least some formulas.
    assert!(
        !formulas.is_empty(),
        "ruleset '{name}' compiled to 0 formulas (expected at least 1)"
    );

    let verifier = PolicyVerifier::new();
    let report = verifier.verify(&formulas, None);

    // Consistency must pass -- no atom should be both permitted and prohibited.
    assert!(
        report.consistency.outcome.is_pass(),
        "ruleset '{name}' failed consistency check: {} conflict(s): {:?}",
        report.consistency.conflict_count,
        report
            .consistency
            .conflicts
            .iter()
            .map(|c| &c.atom)
            .collect::<Vec<_>>()
    );

    // Completeness: built-in rulesets should cover at least the core action types.
    // Note: `permissive` only configures egress_allowlist so it won't cover all
    // four default types. We use a relaxed check for permissive.
    if name != "permissive" {
        assert!(
            report.completeness.outcome.is_pass(),
            "ruleset '{name}' failed completeness check: missing action types {:?}",
            report.completeness.missing
        );
    }

    // Smoke check: formula_count and atom_count should be positive.
    assert!(report.formula_count > 0);
    assert!(report.atom_count > 0);
}

// -- Individual ruleset tests -----------------------------------------------

#[test]
fn verify_default_ruleset() {
    verify_builtin("default");
}

#[test]
fn verify_strict_ruleset() {
    verify_builtin("strict");
}

#[test]
fn verify_ai_agent_ruleset() {
    verify_builtin("ai-agent");
}

#[test]
fn verify_permissive_ruleset() {
    // Permissive only configures egress_allowlist, so we use a custom verifier
    // that only expects egress coverage.
    let ruleset = match RuleSet::by_name("permissive") {
        Ok(Some(rs)) => rs,
        other => panic!("failed to load permissive: {other:?}"),
    };
    let compiler = DefaultPolicyCompiler::new(agent());
    let formulas = compiler.compile_policy(&ruleset.policy);
    assert!(!formulas.is_empty());

    let verifier = PolicyVerifier::new().with_expected_action_types(vec!["egress".to_string()]);
    let report = verifier.verify(&formulas, None);

    assert!(
        report.consistency.outcome.is_pass(),
        "permissive failed consistency"
    );
    assert!(
        report.completeness.outcome.is_pass(),
        "permissive failed completeness for egress: {:?}",
        report.completeness.missing
    );
}

// -- Inheritance tests -------------------------------------------------------

#[test]
fn verify_self_inheritance_default() {
    // A policy should always be inheritance-sound with respect to itself.
    let default_rs = match RuleSet::by_name("default") {
        Ok(Some(rs)) => rs,
        other => panic!("failed to load default: {other:?}"),
    };

    let compiler = DefaultPolicyCompiler::new(agent());
    let formulas = compiler.compile_policy(&default_rs.policy);

    let verifier = PolicyVerifier::new();
    let result = verifier.check_inheritance(&formulas, &formulas);

    assert!(
        result.outcome.is_pass(),
        "self-inheritance should always pass; weakened: {:?}",
        result.weakened.iter().map(|w| &w.atom).collect::<Vec<_>>()
    );
}

#[test]
fn verify_inheritance_strict_forbidden_path_superset() {
    // Strict has a superset of default's forbidden_path patterns, so when we
    // compare only the forbidden_path formulas, inheritance should hold.
    let default_rs = match RuleSet::by_name("default") {
        Ok(Some(rs)) => rs,
        other => panic!("failed to load default: {other:?}"),
    };
    let strict_rs = match RuleSet::by_name("strict") {
        Ok(Some(rs)) => rs,
        other => panic!("failed to load strict: {other:?}"),
    };

    let compiler = DefaultPolicyCompiler::new(agent());

    // Extract only forbidden_path formulas from each policy by using a
    // minimal GuardConfigs with only forbidden_path set.
    let default_fp = clawdstrike::policy::GuardConfigs {
        forbidden_path: default_rs.policy.guards.forbidden_path.clone(),
        ..Default::default()
    };
    let strict_fp = clawdstrike::policy::GuardConfigs {
        forbidden_path: strict_rs.policy.guards.forbidden_path.clone(),
        ..Default::default()
    };

    let default_formulas = compiler.compile_guards(&default_fp);
    let strict_compiler = DefaultPolicyCompiler::new(agent());
    let strict_formulas = strict_compiler.compile_guards(&strict_fp);

    let verifier = PolicyVerifier::new();
    let result = verifier.check_inheritance(&strict_formulas, &default_formulas);

    assert!(
        result.outcome.is_pass(),
        "strict should not weaken any default forbidden_path prohibitions; weakened: {:?}",
        result.weakened.iter().map(|w| &w.atom).collect::<Vec<_>>()
    );
}

// -- Receipt enrichment integration test ------------------------------------

#[test]
fn receipt_enrichment_roundtrip() {
    let ruleset = match RuleSet::by_name("default") {
        Ok(Some(rs)) => rs,
        other => panic!("failed to load default: {other:?}"),
    };
    let compiler = DefaultPolicyCompiler::new(agent());
    let formulas = compiler.compile_policy(&ruleset.policy);

    let verifier = PolicyVerifier::new();
    let report = verifier.verify(&formulas, None);

    let receipt = hush_core::receipt::Receipt::new(
        hush_core::hashing::Hash::zero(),
        hush_core::receipt::Verdict::pass(),
    );
    let enriched = clawdstrike_logos::verifier::enrich_receipt(receipt, &report);

    assert!(enriched.metadata.is_some(), "metadata should be set");
    let meta = match enriched.metadata {
        Some(m) => m,
        None => unreachable!(),
    };
    let v = &meta["verification"];

    assert_eq!(v["z3_verified"], true);
    assert_eq!(v["z3_consistency"], "pass");
    assert!(v["formula_count"].as_u64().unwrap_or(0) > 0);
    assert!(v["atom_count"].as_u64().unwrap_or(0) > 0);
    assert!(v["properties_checked"].as_array().is_some());
}
