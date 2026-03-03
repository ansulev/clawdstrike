"""Tests for PolicyLab native bindings (synth, simulate, OCSF, timeline)."""
import json
from pathlib import Path

import pytest

from clawdstrike.native import NATIVE_AVAILABLE

FIXTURES_DIR = Path(__file__).resolve().parents[4] / "fixtures" / "policy-lab"

SAMPLE_EVENTS_JSONL = """\
{"eventId":"pl-001","eventType":"file_read","timestamp":"2026-03-03T12:00:00Z","data":{"type":"file","path":"/workspace/src/main.rs","operation":"read"}}
{"eventId":"pl-002","eventType":"file_write","timestamp":"2026-03-03T12:00:01Z","data":{"type":"file","path":"/tmp/output.json","operation":"write","content":"{}"}}
{"eventId":"pl-003","eventType":"network_egress","timestamp":"2026-03-03T12:00:02Z","data":{"type":"network","host":"api.github.com","port":443,"protocol":"tcp"}}
{"eventId":"pl-004","eventType":"command_exec","timestamp":"2026-03-03T12:00:03Z","data":{"type":"command","command":"ls","args":["-la"]}}
{"eventId":"pl-005","eventType":"tool_call","timestamp":"2026-03-03T12:00:04Z","data":{"type":"tool","toolName":"read_file","parameters":{"path":"/etc/hosts"}}}
"""

PERMISSIVE_POLICY = """\
version: "1.1.0"
name: Permissive
description: Test permissive policy
guards:
  egress_allowlist:
    allow:
      - "*"
    block: []
    default_action: allow
  patch_integrity:
    max_additions: 10000
    max_deletions: 5000
    require_balance: false
    max_imbalance_ratio: 50.0
settings:
  fail_fast: false
  verbose_logging: true
  session_timeout_secs: 7200
"""

STRICT_POLICY = """\
version: "1.1.0"
name: Strict
description: Test strict policy
guards:
  forbidden_path:
    patterns:
      - /etc/shadow
      - /etc/passwd
  egress_allowlist:
    allow:
      - "api.allowed.com"
    block: []
    default_action: block
settings:
  fail_fast: false
"""


@pytest.mark.skipif(not NATIVE_AVAILABLE, reason="Native backend not available")
class TestPolicyLabSynth:
    """Test PolicyLab.synth() static method."""

    def test_synth_returns_valid_yaml(self):
        from clawdstrike._native import PolicyLab

        result = PolicyLab.synth(SAMPLE_EVENTS_JSONL)
        assert "policy_yaml" in result
        assert len(result["policy_yaml"]) > 0
        # Verify it's valid YAML (should not raise)
        import yaml
        policy = yaml.safe_load(result["policy_yaml"])
        assert policy["name"] == "Synthesized Policy"

    def test_synth_returns_risks(self):
        from clawdstrike._native import PolicyLab

        result = PolicyLab.synth(SAMPLE_EVENTS_JSONL)
        assert "risks" in result
        assert isinstance(result["risks"], list)

    def test_synth_shell_risk(self):
        from clawdstrike._native import PolicyLab

        result = PolicyLab.synth(SAMPLE_EVENTS_JSONL)
        risk_text = " ".join(result["risks"])
        assert "shell" in risk_text.lower()

    def test_synth_empty_events(self):
        from clawdstrike._native import PolicyLab

        result = PolicyLab.synth("")
        assert "policy_yaml" in result
        risk_text = " ".join(result["risks"])
        assert "no events" in risk_text.lower()


@pytest.mark.skipif(not NATIVE_AVAILABLE, reason="Native backend not available")
class TestPolicyLabSimulate:
    """Test PolicyLab.simulate() instance method."""

    def test_permissive_allows_all(self):
        from clawdstrike._native import PolicyLab

        lab = PolicyLab(PERMISSIVE_POLICY)
        result = lab.simulate(SAMPLE_EVENTS_JSONL)
        summary = result["summary"]
        assert summary["total"] == 5
        assert summary["allowed"] == 5
        assert summary["blocked"] == 0

    def test_strict_blocks_unlisted_egress(self):
        from clawdstrike._native import PolicyLab

        lab = PolicyLab(STRICT_POLICY)
        egress_event = json.dumps({
            "eventId": "sim-eg",
            "eventType": "network_egress",
            "timestamp": "2026-03-03T12:00:00Z",
            "data": {
                "type": "network",
                "host": "evil.example.com",
                "port": 443,
            },
        })
        result = lab.simulate(egress_event)
        assert result["summary"]["blocked"] == 1

    def test_strict_blocks_forbidden_path(self):
        from clawdstrike._native import PolicyLab

        lab = PolicyLab(STRICT_POLICY)
        event = json.dumps({
            "eventId": "sim-fp",
            "eventType": "file_read",
            "timestamp": "2026-03-03T12:00:00Z",
            "data": {
                "type": "file",
                "path": "/etc/shadow",
                "operation": "read",
            },
        })
        result = lab.simulate(event)
        assert result["summary"]["blocked"] == 1

    def test_results_contain_event_ids(self):
        from clawdstrike._native import PolicyLab

        lab = PolicyLab(PERMISSIVE_POLICY)
        result = lab.simulate(SAMPLE_EVENTS_JSONL)
        event_ids = [r["eventId"] for r in result["results"]]
        assert "pl-001" in event_ids
        assert "pl-005" in event_ids

    def test_invalid_policy_raises(self):
        from clawdstrike._native import PolicyLab

        with pytest.raises(ValueError):
            PolicyLab("not: valid: policy: {{")


@pytest.mark.skipif(not NATIVE_AVAILABLE, reason="Native backend not available")
class TestPolicyLabOcsf:
    """Test PolicyLab.to_ocsf() static method."""

    def test_ocsf_produces_jsonl(self):
        from clawdstrike._native import PolicyLab

        ocsf = PolicyLab.to_ocsf(SAMPLE_EVENTS_JSONL)
        assert len(ocsf) > 0
        lines = [l for l in ocsf.strip().split("\n") if l.strip()]
        assert len(lines) == 5

    def test_ocsf_class_uid_is_2004(self):
        from clawdstrike._native import PolicyLab

        ocsf = PolicyLab.to_ocsf(SAMPLE_EVENTS_JSONL)
        for line in ocsf.strip().split("\n"):
            if not line.strip():
                continue
            parsed = json.loads(line)
            assert parsed["class_uid"] == 2004

    def test_ocsf_has_required_fields(self):
        from clawdstrike._native import PolicyLab

        ocsf = PolicyLab.to_ocsf(SAMPLE_EVENTS_JSONL)
        first_line = ocsf.strip().split("\n")[0]
        parsed = json.loads(first_line)
        assert "time" in parsed
        assert "severity_id" in parsed
        assert "metadata" in parsed
        assert "product" in parsed["metadata"]


@pytest.mark.skipif(not NATIVE_AVAILABLE, reason="Native backend not available")
class TestPolicyLabTimeline:
    """Test PolicyLab.to_timeline() static method."""

    def test_timeline_produces_jsonl(self):
        from clawdstrike._native import PolicyLab

        timeline = PolicyLab.to_timeline(SAMPLE_EVENTS_JSONL)
        assert len(timeline) > 0
        lines = [l for l in timeline.strip().split("\n") if l.strip()]
        assert len(lines) == 5

    def test_timeline_has_correct_fields(self):
        from clawdstrike._native import PolicyLab

        timeline = PolicyLab.to_timeline(SAMPLE_EVENTS_JSONL)
        first_line = timeline.strip().split("\n")[0]
        parsed = json.loads(first_line)
        assert "timestamp" in parsed
        assert "source" in parsed
        assert "kind" in parsed
        assert "action_type" in parsed


@pytest.mark.skipif(not NATIVE_AVAILABLE, reason="Native backend not available")
class TestPolicyLabFixtures:
    """Test PolicyLab against golden fixture files."""

    def test_fixture_file_parses(self):
        from clawdstrike._native import PolicyLab

        fixture = FIXTURES_DIR / "sample_observation.jsonl"
        if not fixture.exists():
            pytest.skip("Fixture file not found")

        events_jsonl = fixture.read_text()
        ocsf = PolicyLab.to_ocsf(events_jsonl)
        lines = [l for l in ocsf.strip().split("\n") if l.strip()]
        assert len(lines) > 0

    def test_fixture_synth_round_trip(self):
        from clawdstrike._native import PolicyLab

        fixture = FIXTURES_DIR / "sample_observation.jsonl"
        if not fixture.exists():
            pytest.skip("Fixture file not found")

        events_jsonl = fixture.read_text()
        synth_result = PolicyLab.synth(events_jsonl)
        policy_yaml = synth_result["policy_yaml"]
        assert len(policy_yaml) > 0

        # Simulate the same events against the synthesized policy
        lab = PolicyLab(policy_yaml)
        sim_result = lab.simulate(events_jsonl)
        # Synthesized policy should allow most observed events
        assert sim_result["summary"]["total"] > 0
