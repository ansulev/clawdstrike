import { describe, it, expect } from "vitest";
import { parseRule, validateRule } from "./rules.js";

const EXAMPLE_RULE = `
schema: clawdstrike.hunt.correlation.v1
name: "MCP Tool Exfiltration Attempt"
severity: high
description: >
  Detects an MCP tool reading sensitive files followed by
  network egress to an external domain within 30 seconds.
window: 30s
conditions:
  - source: receipt
    action_type: file
    verdict: allow
    target_pattern: "/etc/passwd|/etc/shadow"
    bind: file_access
  - source: [receipt, hubble]
    action_type: egress
    after: file_access
    within: 30s
    bind: egress_event
output:
  title: "Potential data exfiltration via MCP tool"
  evidence:
    - file_access
    - egress_event
`;

describe("parseRule", () => {
  it("parses a valid rule from YAML", () => {
    const rule = parseRule(EXAMPLE_RULE);
    expect(rule.schema).toBe("clawdstrike.hunt.correlation.v1");
    expect(rule.name).toBe("MCP Tool Exfiltration Attempt");
    expect(rule.severity).toBe("high");
    expect(rule.window).toBe(30_000); // 30s in ms
    expect(rule.conditions).toHaveLength(2);

    // First condition — single source string deserialized to array.
    expect(rule.conditions[0].source).toEqual(["receipt"]);
    expect(rule.conditions[0].actionType).toBe("file");
    expect(rule.conditions[0].verdict).toBe("allow");
    expect(rule.conditions[0].targetPattern).toBe("/etc/passwd|/etc/shadow");
    expect(rule.conditions[0].after).toBeUndefined();
    expect(rule.conditions[0].within).toBeUndefined();
    expect(rule.conditions[0].bind).toBe("file_access");

    // Second condition — list source, after + within.
    expect(rule.conditions[1].source).toEqual(["receipt", "hubble"]);
    expect(rule.conditions[1].after).toBe("file_access");
    expect(rule.conditions[1].within).toBe(30_000);
    expect(rule.conditions[1].bind).toBe("egress_event");

    // Output.
    expect(rule.output.title).toBe("Potential data exfiltration via MCP tool");
    expect(rule.output.evidence).toEqual(["file_access", "egress_event"]);
  });

  it("parses single source string", () => {
    const yaml = `
schema: clawdstrike.hunt.correlation.v1
name: "Single source test"
severity: low
description: "test"
window: 5m
conditions:
  - source: tetragon
    bind: evt
output:
  title: "test"
  evidence:
    - evt
`;
    const rule = parseRule(yaml);
    expect(rule.conditions[0].source).toEqual(["tetragon"]);
    expect(rule.window).toBe(300_000); // 5m
  });

  it("supports various duration formats", () => {
    const yaml = `
schema: clawdstrike.hunt.correlation.v1
name: "Duration test"
severity: low
description: "test"
window: 2h
conditions:
  - source: receipt
    bind: evt
output:
  title: "test"
  evidence:
    - evt
`;
    const rule = parseRule(yaml);
    expect(rule.window).toBe(7_200_000); // 2h
  });
});

describe("validateRule", () => {
  it("rejects unknown schema", () => {
    const yaml = `
schema: clawdstrike.hunt.correlation.v99
name: "Bad schema"
severity: low
description: "test"
window: 10s
conditions:
  - source: receipt
    bind: evt
output:
  title: "test"
  evidence:
    - evt
`;
    expect(() => parseRule(yaml)).toThrow("unsupported schema");
  });

  it("rejects empty conditions", () => {
    const yaml = `
schema: clawdstrike.hunt.correlation.v1
name: "No conditions"
severity: medium
description: "test"
window: 10s
conditions: []
output:
  title: "test"
  evidence: []
`;
    expect(() => parseRule(yaml)).toThrow("at least one condition");
  });

  it("rejects invalid after reference", () => {
    const yaml = `
schema: clawdstrike.hunt.correlation.v1
name: "Bad after ref"
severity: high
description: "test"
window: 30s
conditions:
  - source: receipt
    after: nonexistent
    bind: evt
output:
  title: "test"
  evidence:
    - evt
`;
    expect(() => parseRule(yaml)).toThrow("unknown bind 'nonexistent'");
  });

  it("rejects invalid evidence reference", () => {
    const yaml = `
schema: clawdstrike.hunt.correlation.v1
name: "Bad evidence ref"
severity: low
description: "test"
window: 10s
conditions:
  - source: receipt
    bind: evt
output:
  title: "test"
  evidence:
    - missing_bind
`;
    expect(() => parseRule(yaml)).toThrow("unknown bind 'missing_bind'");
  });

  it("rejects within exceeding window", () => {
    const yaml = `
schema: clawdstrike.hunt.correlation.v1
name: "Within exceeds window"
severity: low
description: "test"
window: 10s
conditions:
  - source: receipt
    bind: first
  - source: hubble
    after: first
    within: 60s
    bind: second
output:
  title: "test"
  evidence:
    - first
    - second
`;
    expect(() => parseRule(yaml)).toThrow("exceeds global window");
  });

  it("rejects within without after", () => {
    const yaml = `
schema: clawdstrike.hunt.correlation.v1
name: "Within without after"
severity: low
description: "test"
window: 30s
conditions:
  - source: receipt
    within: 10s
    bind: evt
output:
  title: "test"
  evidence:
    - evt
`;
    expect(() => parseRule(yaml)).toThrow("'within' but no 'after'");
  });

  it("rejects duplicate bind names", () => {
    const yaml = `
schema: clawdstrike.hunt.correlation.v1
name: "Duplicate bind"
severity: high
description: "test"
window: 30s
conditions:
  - source: receipt
    action_type: file
    bind: evt
  - source: hubble
    action_type: egress
    bind: evt
output:
  title: "test"
  evidence:
    - evt
`;
    expect(() => parseRule(yaml)).toThrow("reuses bind name 'evt'");
  });
});
