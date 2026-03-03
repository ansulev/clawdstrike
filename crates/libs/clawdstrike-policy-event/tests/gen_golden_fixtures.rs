#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

//! Generate golden fixture files for the policy-lab test suite.
//! Run with: cargo test -p clawdstrike-policy-event --test gen_golden_fixtures -- --nocapture --ignored

use clawdstrike_policy_event::facade::PolicyLabHandle;
use clawdstrike_policy_event::stream::read_events_from_str;
use clawdstrike_policy_event::synth::{build_candidate_policy, collect_stats};
use std::path::PathBuf;

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
        .join("fixtures")
        .join("policy-lab")
}

#[test]
#[ignore]
fn generate_expected_ocsf() {
    let sample_path = fixtures_dir().join("sample_observation.jsonl");
    let events_jsonl = std::fs::read_to_string(&sample_path).unwrap();

    let ocsf_jsonl = PolicyLabHandle::to_ocsf(&events_jsonl).unwrap();
    let out_path = fixtures_dir().join("expected_ocsf.jsonl");
    std::fs::write(&out_path, &ocsf_jsonl).unwrap();
    println!("Wrote {}", out_path.display());
}

#[test]
#[ignore]
fn generate_expected_policy() {
    let sample_path = fixtures_dir().join("sample_observation.jsonl");
    let events_jsonl = std::fs::read_to_string(&sample_path).unwrap();

    let events = read_events_from_str(&events_jsonl).unwrap();
    let stats = collect_stats(&events);
    let policy = build_candidate_policy(&stats, None, true);
    let yaml = policy.to_yaml().unwrap();

    let out_path = fixtures_dir().join("expected_policy.yaml");
    std::fs::write(&out_path, &yaml).unwrap();
    println!("Wrote {}", out_path.display());
}
