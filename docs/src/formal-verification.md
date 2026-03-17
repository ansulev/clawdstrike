# Formal Verification

ClawdStrike provides formally verified policy enforcement -- mathematical proof that your security policies behave correctly. This goes beyond testing: instead of checking a finite number of inputs, we prove properties hold for *all possible* inputs.

## Why it matters

Policy engines make security decisions. A bug in the aggregation logic could silently allow an action that should be blocked. Traditional testing can miss edge cases. Formal verification eliminates entire classes of bugs by proving the logic correct at a mathematical level.

Concretely, ClawdStrike's formal verification guarantees:

- **Deny always wins.** If any guard blocks an action, the final verdict is always "deny" -- no combination of other guards can override it.
- **Inheritance never weakens security.** When a child policy extends a parent, the child cannot silently remove prohibitions.
- **Circular extends chains are always caught.** Policy resolution will never loop forever or silently ignore cycles.
- **Errors fail closed.** A misconfigured policy (unsupported version, invalid config) always results in denial, never silent approval.

## Quick start

### Verify a policy

```bash
hush policy verify my-policy.yaml
```

This compiles your policy into normative logic formulas and checks three properties:

1. **Consistency** -- No action is simultaneously permitted and forbidden
2. **Completeness** -- All action types (file, network, shell, MCP) are covered by at least one guard
3. **Inheritance soundness** -- If your policy extends a parent, it does not weaken any of the parent's prohibitions

Example output:

```text
Policy: my-policy.yaml (resolved)

  Consistency ............ PASS  (0 conflicts)
  Completeness ........... PASS  (5/5 action types covered)
  Inheritance soundness .. PASS  (0 weakened prohibitions)

All checks passed.
```

### Verify with JSON output

```bash
hush policy verify --json my-policy.yaml
```

Returns structured output suitable for CI pipelines and automated processing.

### Verify a built-in ruleset

```bash
hush policy verify clawdstrike:strict
hush policy verify clawdstrike:ai-agent
```

## Attestation levels

Every ClawdStrike receipt includes a verification attestation level indicating the depth of assurance behind the policy decision.

| Level | Name | What it means | How to achieve |
|-------|------|---------------|----------------|
| 0 | Heuristic | Guards ran, no formal checks | Default behavior |
| 1 | Z3-Verified | Policy is mathematically consistent | `hush policy verify` passes |
| 2 | Lean-Proved | Core properties proved about the spec | Lean 4 spec builds cleanly |
| 3 | Impl-Verified | Properties proved about the actual Rust code | Aeneas proofs complete |

Most users will operate at Level 1 (Z3-Verified). This is the level you get by running `hush policy verify` in CI. Levels 2 and 3 are provided by the project's own build infrastructure and give assurance about the engine itself, not your specific policy.

## Verification in CI

Add policy verification to your CI pipeline to catch problems before deployment.

### GitHub Actions

```yaml
name: Policy verification

on:
  pull_request:
    paths:
      - ".hush/**/*.yaml"
      - ".hush/**/*.yml"

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable

      - name: Install ClawdStrike CLI
        run: cargo install --path crates/services/hush-cli

      - name: Verify policy
        run: hush policy verify --resolve .hush/policy.yaml

      - name: Verify policy (JSON for artifacts)
        run: |
          hush policy verify --json --resolve .hush/policy.yaml \
            > policy-verification.json

      - uses: actions/upload-artifact@v4
        with:
          name: policy-verification
          path: policy-verification.json
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | One or more checks failed |
| 2 | Policy could not be loaded (parse error, missing file, etc.) |

## What we prove

### Core properties (Lean 4 specification)

The following properties are stated and proved in the Lean 4 formal specification at `formal/lean4/ClawdStrike/`. These are machine-checked -- Lean's type checker guarantees the proofs are valid.

**P1: Deny monotonicity.** If any guard in the result list has `allowed = false`, then the aggregate verdict has `allowed = false`. This is the critical safety property. Without it, a single guard's denial could be silently overridden.

**P2: Allow requires unanimity.** The contrapositive of P1 -- if the aggregate allows, then *every* guard allowed. No guard's denial was dropped.

**P3: Severity total order.** The severity levels (Info < Warning < Error < Critical) form a well-defined total order. This ensures the aggregation comparison logic is deterministic.

**P4: Forbidden path soundness.** If a policy has an enabled forbidden path guard, and a file path matches a forbidden pattern without matching any exception, the guard produces a denial.

**P5: Inheritance restrictiveness.** Deep-merging a child policy with a base produces a policy that is at least as restrictive as the base. Prohibitions from the base are preserved unless explicitly removed.

**P9: Fail-closed on config error.** If the policy has an unsupported schema version, evaluation returns an error. The engine never silently proceeds with a misconfigured policy.

**P10: Cycle detection.** If a policy key appears in the visited set during extends resolution, the cycle is detected and an error is returned. Extends chains deeper than 32 levels are also rejected.

**P11: Empty results safety.** When no guards match an action, the engine returns an explicit allow verdict (not undefined behavior or an error).

**P12: Disabled guard transparency.** A disabled guard always produces an allow verdict, ensuring it has no effect on the aggregate.

**P13: Action irrelevance.** Guards only affect actions in their domain. A ForbiddenPathGuard has no effect on shell commands; an EgressAllowlistGuard has no effect on file access.

### Properties checked by `hush policy verify` (Z3/Logos)

These are checked at the policy level (your specific YAML), not the engine level:

- **Consistency**: No action atom is simultaneously permitted and prohibited for the same agent.
- **Completeness**: All expected action types (file access, file write, network egress, shell command, MCP tool) have at least one covering formula.
- **Inheritance soundness**: No prohibition from a parent policy is weakened (removed) in the child.

### What we do not prove

Formal verification has a scope. Here is what falls outside it:

- **Guard heuristic accuracy.** Pattern matching quality (regex, glob) is axiomatized -- we prove the logic around matching is correct, not that any specific pattern catches every threat.
- **External crypto implementations.** Ed25519 signature internals (provided by the `ed25519-dalek` crate) are trusted, not verified.
- **Async guard timeout behavior.** The formal spec models guards as pure synchronous functions. Timeout, cancellation, and concurrency behavior in async guards are tested, not proved.
- **Content-dependent guard analysis.** Guards like JailbreakGuard and PromptInjectionGuard use ML models and heuristics for detection. The formal spec models them as opaque functions and proves properties about how their verdicts are aggregated, not about detection accuracy.
- **Serde deserialization.** YAML parsing and deserialization are outside the verified core. Invalid YAML is handled by fail-closed load-time validation.

## How it works

ClawdStrike uses three complementary verification approaches:

### 1. Z3/Logos policy verification (Level 1)

When you run `hush policy verify`, your policy YAML is compiled into normative logic formulas via the Logos framework. Each guard configuration produces permissions and prohibitions:

```text
ForbiddenPathConfig  -->  Prohibition(access("/etc/shadow"))
EgressAllowlistConfig --> Permission(egress("api.github.com"))
                          Prohibition(egress("*"))  (default deny)
McpToolConfig        -->  Prohibition(tool("shell_exec"))
```

These formulas are checked for consistency (no conflicts), completeness (all action types covered), and inheritance soundness (child does not weaken parent).

### 2. Lean 4 specification (Level 2)

The formal specification lives in `formal/lean4/ClawdStrike/` and models the policy engine as pure functions in Lean 4. The specification mirrors the Rust implementation:

| Lean module | Rust source | What it models |
|-------------|-------------|----------------|
| `Core/Verdict.lean` | `core/verdict.rs` | Severity, GuardResult, Action, Policy types |
| `Core/Aggregate.lean` | `core/aggregate.rs` | The `aggregate_overall` verdict selection |
| `Core/Merge.lean` | `policy.rs` | Policy inheritance merge logic |
| `Core/Cycle.lean` | `core/cycle.rs` | Extends chain cycle detection |
| `Core/Eval.lean` | `engine.rs`, `guards/*.rs` | Per-guard evaluation and full policy evaluation |
| `Spec/Properties.lean` | -- | Theorem statements and proofs |

To build the specification and check all proofs:

```bash
cd formal/lean4/ClawdStrike && lake build
```

### 3. Aeneas implementation verification (Level 3)

[Aeneas](https://github.com/AeneasVerif/aeneas) translates the actual Rust source code into Lean 4, producing a faithful model of the implementation (not a hand-written approximation). The generated Lean code lives alongside the specification, allowing proofs that the Rust implementation matches the spec.

The Aeneas-generated types can be found in `formal/lean4/ClawdStrike/ClawdStrike/Impl/`. These are auto-generated -- do not edit them by hand.

### 4. Differential testing

The `formal-diff-tests` crate uses property-based testing (proptest) to compare the reference specification against the production Rust implementation on randomly generated inputs. This bridges the gap between the Lean spec and the Rust code by testing agreement at scale.

```bash
cargo test -p formal-diff-tests
```

The differential tests cover:

- **Aggregate logic**: Random verdict lists are aggregated by both the spec and the implementation; results must match.
- **Cycle detection**: Random policy graphs are checked for cycles by both implementations.
- **Merge logic**: Random policy configurations are merged by both implementations; results must match.

## For power users

### Building the Lean specification

Prerequisites: [Lean 4](https://leanprover.github.io/lean4/doc/setup.html) (via elan) and [Lake](https://github.com/leanprover/lean4/tree/master/src/lake) (bundled with Lean).

```bash
# Install Lean 4 (if not already installed)
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh

# Build the specification and check all proofs
cd formal/lean4/ClawdStrike
lake build
```

A successful build means every theorem statement in `Spec/Properties.lean` has been verified by Lean's kernel.

### Running the full verification suite

```bash
# Z3 policy verification (your policies)
hush policy verify my-policy.yaml

# Differential tests (spec vs. implementation agreement)
cargo test -p formal-diff-tests

# Lean specification (engine correctness proofs)
cd formal/lean4/ClawdStrike && lake build
```

### Regenerating Aeneas output

If the Rust `core` module changes, the Aeneas-generated Lean code needs to be regenerated:

```bash
# Requires charon and aeneas binaries installed
charon --crate clawdstrike
aeneas --backend lean4 clawdstrike.llbc
```

The generated files go into `formal/lean4/ClawdStrike/ClawdStrike/Impl/`. After regeneration, run `lake build` to verify the proofs still hold against the updated implementation.

## Further reading

- [Design Philosophy](concepts/design-philosophy.md) -- Fail-closed principles that formal verification enforces
- [Policy Inheritance](guides/policy-inheritance.md) -- How `extends` chains work (and why inheritance soundness matters)
- [GitHub Actions recipe](recipes/github-actions.md) -- General CI integration patterns
