# Quick Start

Evaluate actions against policies in a few minutes.

## Step 1: Install

```bash
cargo install --path crates/services/hush-cli
```

## Step 2: Pick a ruleset

List the built-ins:

```bash
clawdstrike policy list
```

Inspect one:

```bash
clawdstrike policy show ai-agent
```

## Step 3: Run checks

### File access

```bash
# Allowed example (depends on your local paths)
clawdstrike check --action-type file --ruleset default ./README.md

# Blocked example
clawdstrike check --action-type file --ruleset strict ~/.ssh/id_rsa
```

### Network egress

```bash
# Allowed in default ruleset
clawdstrike check --action-type egress --ruleset default api.github.com:443

# Blocked in strict ruleset (strict defaults to deny)
clawdstrike check --action-type egress --ruleset strict api.github.com:443
```

## Step 4: Create a policy file

Policies configure built-in guards under `guards.*` and can inherit via `extends`.

Create `policy.yaml`:

```yaml
version: "1.2.0"
name: My Policy
extends: clawdstrike:ai-agent

guards:
  egress_allowlist:
    additional_allow:
      - "api.stripe.com"
```

Validate (and optionally resolve `extends`):

```bash
clawdstrike policy validate policy.yaml
clawdstrike policy validate --resolve policy.yaml
```

Run checks using the file:

```bash
clawdstrike check --action-type egress --policy policy.yaml api.stripe.com:443
```

## Step 5: Observe -> Synth -> Tighten (recommended)

Use observed real activity to generate and tighten least-privilege policy:

```bash
# Observe one representative run
clawdstrike policy observe --out run.events.jsonl -- your-agent-command

# Synthesize candidate policy
clawdstrike policy synth run.events.jsonl \
  --extends clawdstrike:default \
  --out candidate.yaml \
  --risk-out candidate.risks.md

# Validate and replay against observed events
clawdstrike policy validate candidate.yaml
clawdstrike policy simulate candidate.yaml run.events.jsonl --fail-on-deny
```

TypeScript automation (same loop via CLI):

```typescript
import { execFileSync } from "node:child_process";

execFileSync(
  "clawdstrike",
  ["policy", "observe", "--out", "run.events.jsonl", "--", "/bin/sh", "-lc", "echo hello"],
  { stdio: "inherit" },
);

execFileSync(
  "clawdstrike",
  [
    "policy",
    "synth",
    "run.events.jsonl",
    "--extends",
    "clawdstrike:default",
    "--out",
    "candidate.yaml",
    "--risk-out",
    "candidate.risks.md",
  ],
  { stdio: "inherit" },
);

execFileSync("clawdstrike", ["policy", "validate", "candidate.yaml"], { stdio: "inherit" });
execFileSync(
  "clawdstrike",
  ["policy", "simulate", "candidate.yaml", "run.events.jsonl", "--fail-on-deny"],
  { stdio: "inherit" },
);
```

Python automation (same loop via CLI):

```python
import subprocess

subprocess.run(
    [
        "clawdstrike",
        "policy",
        "observe",
        "--out",
        "run.events.jsonl",
        "--ocsf-out",
        "run.ocsf.jsonl",
        "--",
        "/bin/sh",
        "-lc",
        "echo hello",
    ],
    check=True,
)

subprocess.run(
    [
        "clawdstrike",
        "policy",
        "synth",
        "run.events.jsonl",
        "--extends",
        "clawdstrike:default",
        "--out",
        "candidate.yaml",
        "--risk-out",
        "candidate.risks.md",
    ],
    check=True,
)
subprocess.run(["clawdstrike", "policy", "validate", "candidate.yaml"], check=True)
subprocess.run(
    ["clawdstrike", "policy", "simulate", "candidate.yaml", "run.events.jsonl", "--fail-on-deny"],
    check=True,
)
```

For the full end-to-end flow (including hunt analysis and OCSF export), see [Observe -> Synth -> Tighten](../guides/observe-synth.md).

## Notes

- `clawdstrike check` evaluates a single action; it does not sandbox or wrap a process.
- For integration into an agent runtime, call the Rust API (`clawdstrike::HushEngine`) before performing actions.

## Next Steps

- [Your First Policy](./first-policy.md)
- [Policy Schema](../reference/policy-schema.md)
- [CLI Reference](../reference/api/cli.md)
