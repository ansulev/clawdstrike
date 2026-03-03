# Guide: Observe → Analyze → Synth → Tighten

Build least-privilege agent policies from real activity — not guesswork.

This guide walks through the full loop: capture what your agent actually does, query and analyze it with the unified PolicyEvent pipeline, export to OCSF for SIEM integration, synthesize a candidate policy, simulate it, and tighten it down to exactly what's needed.

## Prerequisites

- `clawdstrike` CLI installed from this branch or a compatible release.
- For `clawdstrike hunt` cross-source examples (`tetragon`, `hubble`): those sources must be available and indexed.
- For `--hushd-url` observation mode: a running hushd daemon and valid session ID.

## 1. Observe activity

Run your agent under observation to capture every action it takes.

**Local command mode** — wraps a single agent run:

```bash
clawdstrike policy observe --out run.events.jsonl -- your-agent-command --arg value
```

**hushd session mode** — taps a live session from the daemon:

```bash
clawdstrike policy observe \
  --hushd-url http://127.0.0.1:9876 \
  --session <session_id> \
  --out session.events.jsonl
```

Both produce a canonical `PolicyEvent` JSONL stream: every file access, network call, shell command, MCP tool invocation, and patch — with the guard decision, severity, and target.

Run your agent through its real workload. The more representative the observation, the tighter the synthesized policy.

## 2. Query with Hunt

PolicyEvents bridge directly to hunt-query `TimelineEvent`s, so you can query, correlate, and understand what happened using the same timeline tools that work with Tetragon and Hubble sources.

If you do not have live telemetry sources available, run hunt commands with `--offline --local-dir <dir>` against local exports.

### Timeline view

See everything chronologically — process activity from Tetragon, network flows from Hubble, and guard decisions from receipts, merged into one timeline:

```bash
clawdstrike hunt timeline \
  --source receipt,tetragon,hubble \
  --start 1h \
  --entity my-agent-pod
```

### Structured queries

Filter to specific patterns:

```bash
# All denied guard decisions in the last hour
clawdstrike hunt query --verdict deny --start 1h

# Network egress from a specific pod
clawdstrike hunt query --source hubble --action-type egress --pod my-agent

# Shell commands that were blocked
clawdstrike hunt query --source receipt --action-type shell --verdict deny
```

The PolicyEvent-to-TimelineEvent bridge maps each event type to the correct `action_type`:

| PolicyEvent type | action_type | TimelineEventKind |
|------------------|-------------|-------------------|
| `file_read`, `file_write` | `file` | GuardDecision |
| `network_egress` | `egress` | GuardDecision |
| `command_exec` | `shell` | GuardDecision |
| `tool_call` | `tool` | GuardDecision |
| `patch_apply` | `patch` | GuardDecision |
| `secret_access` | `secret` | GuardDecision |
| CUA events | `cua` | GuardDecision |

Verdict metadata from the event (`verdict` or `decision` field) is normalized to `Allow`, `Deny`, or `Warn`.

## 3. OCSF export

PolicyEvents can be converted directly to OCSF v1.4.0 compliant Detection Finding events (class_uid 2004) for SIEM ingestion. This is available both from the CLI and programmatically.

**CLI export:**

```bash
clawdstrike policy observe --out run.events.jsonl --ocsf-out run.ocsf.jsonl -- your-agent-command
```

**Key OCSF fields carried through:**

- `class_uid` — always 2004 (Detection Finding)
- `category_uid` — always 2 (Findings)
- `severity_id` — correctly mapped (Critical = 5, not 6)
- `action_id` / `disposition_id` — Allowed (1), Denied/Blocked (2), or Logged (17) for warnings
- `finding_info.analytic` — the guard name and rule type
- `metadata.product` — ClawdStrike + version for attribution
- `time` — epoch milliseconds from the original event timestamp

This means your SIEM dashboards and detection rules can distinguish between clean allows, hard denies, and logged warnings — all in standard OCSF.

## 4. Synthesize a candidate policy

Feed the observation into `policy synth` to generate a least-privilege policy:

```bash
clawdstrike policy synth run.events.jsonl \
  --extends clawdstrike:default \
  --out candidate.yaml \
  --diff-out candidate.diff.json \
  --risk-out candidate.risks.md \
  --with-posture
```

Synth analyzes the event stream and produces:

- **`candidate.yaml`** — a policy overlay that allows exactly what was observed, nothing more
- **`candidate.diff.json`** — structural diff against the base policy so you see what changed
- **`candidate.risks.md`** — a review checklist flagging anything that looks overly broad

The synthesizer examines file access patterns, egress destinations, shell commands, MCP tool calls, and patches. With `--with-posture`, it also generates posture rules — capability budgets and state transitions.

## 5. Simulate

Before deploying, validate the policy and replay your observations against it:

```bash
# Check the policy is well-formed
clawdstrike policy validate candidate.yaml

# Replay events — every deny here is something your agent needs that the policy blocks
clawdstrike policy simulate candidate.yaml run.events.jsonl \
  --json \
  --track-posture \
  --fail-on-deny
```

If `--fail-on-deny` exits non-zero, your synthesized policy is too tight for the observed workload. Check the output for which actions were denied and adjust.

## 6. SDK usage

You can automate this workflow from code in every supported language via `PolicyLab`.

`PolicyLab` requires package builds that include PolicyLab bindings:
- TypeScript: `@clawdstrike/sdk` with compatible `@clawdstrike/wasm` exports.
- Python: `clawdstrike` wheel with bundled native extension support.
If your package registry has not published those versions yet, install from a local checkout of this repository.

### Rust

```rust,ignore
use clawdstrike_policy_event::facade::PolicyLabHandle;

// Synthesize a policy from observed events
let synth_result = PolicyLabHandle::synth(events_jsonl)?;
println!("{}", synth_result.policy_yaml);

// Simulate events against a policy
let handle = PolicyLabHandle::new(policy_yaml)?;
let sim_result = handle.simulate(events_jsonl)?;
println!("allowed: {}, blocked: {}", sim_result.summary.allowed, sim_result.summary.blocked);

// Convert to OCSF
let ocsf_jsonl = PolicyLabHandle::to_ocsf(events_jsonl)?;

// Convert to hunt-query TimelineEvents
let timeline_jsonl = PolicyLabHandle::to_timeline(events_jsonl)?;
```

### TypeScript

```typescript
import { readFileSync, writeFileSync } from "node:fs";
import { PolicyLab } from "@clawdstrike/sdk";

// Observe
// Create run.events.jsonl with `clawdstrike policy observe ...` (or hushd export).
const eventsJsonl = readFileSync("run.events.jsonl", "utf8");

// Synthesize + optional OCSF export
const synth = await PolicyLab.synth(eventsJsonl);
writeFileSync("candidate.yaml", synth.policyYaml);
writeFileSync("candidate.risks.md", synth.risks.map((risk) => `- ${risk}`).join("\n") + "\n");
writeFileSync("run.ocsf.jsonl", await PolicyLab.toOcsf(eventsJsonl));

// Tighten (policy parse validation)
await PolicyLab.create(synth.policyYaml);
```

`PolicyLab.simulate()` is not available in the TypeScript WASM build. Use Python, Go, Rust, or CLI for replay simulation.

### Python

```python
from pathlib import Path
from clawdstrike import PolicyLab

# Observe
# Create run.events.jsonl with `clawdstrike policy observe ...` (or hushd export).
events_jsonl = Path("run.events.jsonl").read_text(encoding="utf-8")

# Synthesize + optional OCSF export
synth = PolicyLab.synth(events_jsonl)
policy_yaml = synth["policy_yaml"]
Path("candidate.yaml").write_text(policy_yaml, encoding="utf-8")
Path("candidate.risks.md").write_text(
    "".join(f"- {risk}\n" for risk in synth["risks"]),
    encoding="utf-8",
)
Path("run.ocsf.jsonl").write_text(PolicyLab.to_ocsf(events_jsonl), encoding="utf-8")

# Tighten (validate + replay)
lab = PolicyLab(policy_yaml)  # validates policy structure
simulation = lab.simulate(events_jsonl)
blocked = simulation["summary"]["blocked"]
if blocked > 0:
    raise SystemExit(f"tightening needed: blocked={blocked}")
```

## 7. Tighten

Synthesis is intentionally conservative — it allows what it saw. Your job is to remove what shouldn't be there:

- **Filesystem allowlists** — does the agent really need `/tmp/*` or just `/tmp/workspace/`?
- **Egress hosts** — pin to exact domains, not wildcards
- **Shell commands** — restrict to the specific commands observed, not broad patterns
- **MCP tool access** — allow only the tools the agent actually called
- **Posture budgets** — set capability limits based on observed maximums, not unbounded

### Hunt-informed tightening

Use hunt queries to inform each decision:

```bash
# What files did the agent actually touch?
clawdstrike hunt query --source receipt --action-type file --verdict allow --start 24h

# What egress destinations were used?
clawdstrike hunt query --source hubble --action-type egress --verdict forwarded --start 24h

# Were there any warns that should become denies?
clawdstrike hunt query --verdict warn --start 24h
```

Warnings are particularly useful — they represent actions that were allowed but flagged. Review each one: if the action is expected, leave it allowed. If it's not, tighten the policy to deny it.

## Putting it together

The full loop for a new agent:

```bash
# 1. Observe a representative run
clawdstrike policy observe --out run.events.jsonl -- my-agent --task "process invoices"

# 2. Look at what happened
clawdstrike hunt timeline --offline --local-dir . --source receipt

# 3. Synthesize
clawdstrike policy synth run.events.jsonl \
  --extends clawdstrike:default \
  --out my-agent-policy.yaml \
  --risk-out risks.md

# 4. Review the risks
cat risks.md

# 5. Simulate to verify
clawdstrike policy simulate my-agent-policy.yaml run.events.jsonl --fail-on-deny

# 6. Deploy
cp my-agent-policy.yaml ~/.clawdstrike/policies/my-agent.yaml
```

After deployment, keep the hunt timeline running. New actions that get denied tell you the agent's behavior changed — update the policy or investigate why.
