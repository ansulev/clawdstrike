//! `hush policy verify` -- Static verification of policy properties via Logos
//! normative formula compilation and inspection.

use std::io::Write;

use colored::Colorize;

use clawdstrike_logos::compiler::{DefaultPolicyCompiler, PolicyCompiler};
use clawdstrike_logos::logos_ffi::AgentId;
use clawdstrike_logos::verifier::{
    AttestationLevel, CheckOutcome, PolicyVerifier, VerificationReport,
};

use crate::policy_diff::{ResolvedPolicySource, ResolvedPolicySource as Rps};
use crate::remote_extends::RemoteExtendsConfig;
use crate::ui;
use crate::{CliJsonError, ExitCode, PolicySource, CLI_JSON_VERSION};

// ---------------------------------------------------------------------------
// CLI command struct
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct PolicyVerifyCommand {
    pub policy_ref: String,
    pub resolve: bool,
    pub json: bool,
    pub attestation_level: bool,
    pub verbose: bool,
}

// ---------------------------------------------------------------------------
// JSON output type
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, serde::Serialize)]
pub struct PolicyVerifyJsonOutput {
    pub version: u8,
    pub command: &'static str,
    pub policy: PolicySource,
    pub outcome: &'static str,
    pub exit_code: i32,
    pub attestation_level: u8,
    pub attestation_level_name: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub report: Option<VerificationReport>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<CliJsonError>,
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

pub fn cmd_policy_verify(
    command: PolicyVerifyCommand,
    remote_extends: &RemoteExtendsConfig,
    stdout: &mut dyn Write,
    stderr: &mut dyn Write,
) -> ExitCode {
    let PolicyVerifyCommand {
        policy_ref,
        resolve,
        json,
        attestation_level: show_attestation_level,
        verbose,
    } = command;

    // Load the policy.
    let loaded =
        match crate::policy_diff::load_policy_from_arg(&policy_ref, resolve, remote_extends) {
            Ok(v) => v,
            Err(e) => {
                let code = crate::policy_error_exit_code(&e.source);
                let error_kind = if code == ExitCode::RuntimeError {
                    "runtime_error"
                } else {
                    "config_error"
                };
                let message = e.message;
                let policy = guess_policy_source(&policy_ref);

                if json {
                    let output = PolicyVerifyJsonOutput {
                        version: CLI_JSON_VERSION,
                        command: "policy_verify",
                        policy,
                        outcome: "error",
                        exit_code: code.as_i32(),
                        attestation_level: AttestationLevel::Heuristic.as_u8(),
                        attestation_level_name: AttestationLevel::Heuristic.name(),
                        report: None,
                        error: Some(CliJsonError {
                            kind: error_kind,
                            message: message.clone(),
                        }),
                    };
                    let _ = writeln!(
                        stdout,
                        "{}",
                        serde_json::to_string_pretty(&output).unwrap_or_else(|_| "{}".to_string())
                    );
                    return code;
                }

                let _ = writeln!(stderr, "Error: {}", message);
                return code;
            }
        };

    let policy_source = policy_source_for_loaded(&loaded.source);
    let policy = &loaded.policy;

    // Compile to formulas.
    let agent = AgentId::new("clawdstrike-agent");
    let compiler = DefaultPolicyCompiler::new(agent.clone());
    let formulas = compiler.compile_policy(policy);

    // If the policy extends a base, compile the base too for inheritance check.
    let base_formulas = if let Some(ref extends_name) = policy.extends {
        match crate::policy_diff::load_policy_from_arg(extends_name, resolve, remote_extends) {
            Ok(base_loaded) => {
                let base_compiler = DefaultPolicyCompiler::new(agent);
                Some(base_compiler.compile_policy(&base_loaded.policy))
            }
            Err(_) => None,
        }
    } else {
        None
    };

    // Run verification.
    let verifier = PolicyVerifier::new();
    let report = verifier.verify(&formulas, base_formulas.as_deref());

    let all_pass = report.all_pass();
    let code = if all_pass {
        ExitCode::Ok
    } else {
        ExitCode::Fail
    };

    if json {
        let output = PolicyVerifyJsonOutput {
            version: CLI_JSON_VERSION,
            command: "policy_verify",
            policy: policy_source,
            outcome: if all_pass { "pass" } else { "fail" },
            exit_code: code.as_i32(),
            attestation_level: report.attestation_level.as_u8(),
            attestation_level_name: report.attestation_level.name(),
            report: Some(report),
            error: None,
        };
        let _ = writeln!(
            stdout,
            "{}",
            serde_json::to_string_pretty(&output).unwrap_or_else(|_| "{}".to_string())
        );
        return code;
    }

    // Human-readable output.
    let _ = writeln!(stdout);
    let _ = writeln!(stdout, "Policy Verification Report");
    let _ = writeln!(stdout, "==========================");
    let _ = writeln!(stdout, "Policy: {}", &policy_ref);
    let _ = writeln!(stdout, "Schema: v{}", policy.version);

    if let Some(ref extends_name) = policy.extends {
        let _ = writeln!(stdout, "Extends: {}", extends_name);
    }

    let _ = writeln!(stdout);
    let _ = writeln!(stdout, "Formulas compiled: {}", report.formula_count);
    let _ = writeln!(stdout, "Action atoms:      {}", report.atom_count);
    let _ = writeln!(stdout);

    // Consistency
    let consistency_label = outcome_label(&report.consistency.outcome);
    let _ = writeln!(
        stdout,
        "Consistency:       {}  ({} conflicts in {} formulas)",
        consistency_label, report.consistency.conflict_count, report.formula_count,
    );
    for conflict in &report.consistency.conflicts {
        let _ = writeln!(
            stdout,
            "  ! Conflict: {} is both permitted and prohibited",
            conflict.atom
        );
    }

    // Completeness
    let completeness_label = outcome_label(&report.completeness.outcome);
    let covered = report.completeness.covered.len();
    let total = covered + report.completeness.missing.len();
    let _ = writeln!(
        stdout,
        "Completeness:      {}  ({}/{} action types covered)",
        completeness_label, covered, total,
    );
    for missing in &report.completeness.missing {
        let _ = writeln!(stdout, "  ! Missing action type: {}", missing);
    }

    // Inheritance
    let inheritance_label = outcome_label(&report.inheritance.outcome);
    match report.inheritance.outcome {
        CheckOutcome::Skipped => {
            let _ = writeln!(
                stdout,
                "Inheritance:       {}  (no base policy)",
                inheritance_label,
            );
        }
        _ => {
            let _ = writeln!(
                stdout,
                "Inheritance:       {}  ({} weakened prohibitions from base {:?})",
                inheritance_label,
                report.inheritance.weakened.len(),
                policy.extends.as_deref().unwrap_or("unknown"),
            );
            for w in &report.inheritance.weakened {
                let _ = writeln!(
                    stdout,
                    "  ! Weakened prohibition: {} (present in base, absent in child)",
                    w.atom
                );
            }
        }
    }

    let _ = writeln!(stdout);
    let _ = writeln!(
        stdout,
        "Verification time: {}ms",
        report.verification_time_ms
    );

    // Attestation level
    if show_attestation_level {
        let _ = writeln!(stdout);
        let _ = writeln!(
            stdout,
            "Attestation level: {}",
            attestation_level_label(&report.attestation_level),
        );
        let _ = writeln!(stdout, "  Level 0: Heuristic guards only");
        let _ = writeln!(
            stdout,
            "  Level 1: Z3-verified policy consistency  {}",
            if report.attestation_level >= AttestationLevel::Z3Verified {
                "[achieved]".green().to_string()
            } else {
                "[not achieved]".dimmed().to_string()
            }
        );
        let _ = writeln!(
            stdout,
            "  Level 2: Lean-proved properties          {}",
            if report.attestation_level >= AttestationLevel::LeanProved {
                "[achieved]".green().to_string()
            } else {
                "[not available]".dimmed().to_string()
            }
        );
        let _ = writeln!(
            stdout,
            "  Level 3: Aeneas-verified implementation  {}",
            if report.attestation_level >= AttestationLevel::ImplementationVerified {
                "[achieved]".green().to_string()
            } else {
                "[not available]".dimmed().to_string()
            }
        );
    }

    // Verbose formula listing
    if verbose {
        let _ = writeln!(stdout);
        let _ = writeln!(stdout, "Compiled Formulas ({}):", formulas.len());
        let _ = writeln!(stdout, "{}", "-".repeat(40));
        for (i, formula) in formulas.iter().enumerate() {
            let _ = writeln!(stdout, "  [{}] {}", i + 1, formula);
        }
    }

    if all_pass {
        let _ = writeln!(
            stdout,
            "\n{} All verification checks passed.",
            ui::Verdict::Pass.badge()
        );
    } else {
        let _ = writeln!(
            stdout,
            "\n{} One or more verification checks failed.",
            ui::Verdict::Fail.badge()
        );
    }

    code
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn outcome_label(outcome: &CheckOutcome) -> String {
    match outcome {
        CheckOutcome::Pass => "PASS".green().bold().to_string(),
        CheckOutcome::Fail => "FAIL".red().bold().to_string(),
        CheckOutcome::Skipped => "SKIP".yellow().bold().to_string(),
    }
}

fn attestation_level_label(level: &AttestationLevel) -> String {
    match level {
        AttestationLevel::Heuristic => format!("{} (heuristic)", "Level 0".yellow().bold()),
        AttestationLevel::Z3Verified => format!("{} (z3_verified)", "Level 1".green().bold()),
        AttestationLevel::LeanProved => format!("{} (lean_proved)", "Level 2".green().bold()),
        AttestationLevel::ImplementationVerified => {
            format!("{} (implementation_verified)", "Level 3".green().bold())
        }
    }
}

fn policy_source_for_loaded(source: &ResolvedPolicySource) -> PolicySource {
    match source {
        Rps::Ruleset { id } => PolicySource::Ruleset { name: id.clone() },
        Rps::File { path } => PolicySource::PolicyFile { path: path.clone() },
    }
}

fn guess_policy_source(policy_ref: &str) -> PolicySource {
    match clawdstrike::RuleSet::by_name(policy_ref) {
        Ok(Some(rs)) => PolicySource::Ruleset { name: rs.id },
        _ => PolicySource::PolicyFile {
            path: policy_ref.to_string(),
        },
    }
}
