import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import { toOcsf } from "../src/siem/transforms/ocsf";
import type { SecurityEvent } from "../src/siem/types";

function loadFixture(name: string): Record<string, unknown> {
  const fixturePath = path.resolve(__dirname, "../../../../fixtures/ocsf", name);
  return JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
}

function sampleEvent(overrides: Partial<SecurityEvent> = {}): SecurityEvent {
  return {
    schema_version: "1.0.0",
    event_id: "evt-ocsf-001",
    event_type: "guard_block",
    event_category: "file",
    timestamp: "2024-03-02T12:00:00.000Z",
    agent: { id: "agent-1", name: "test-agent", version: "0.1.3", type: "clawdstrike" },
    session: { id: "sess-1", tenant_id: "tenant-1", environment: "test" },
    outcome: "failure",
    action: "file_access",
    threat: {},
    decision: {
      allowed: false,
      guard: "ForbiddenPathGuard",
      severity: "critical",
      reason: "Blocked access to /etc/shadow",
    },
    resource: { type: "file", name: "/etc/shadow", path: "/etc/shadow" },
    metadata: {},
    labels: {},
    ...overrides,
  };
}

describe("siem.transforms.ocsf", () => {
  it("produces Detection Finding class_uid 2004", () => {
    const ocsf = toOcsf(sampleEvent());
    expect(ocsf.class_uid).toBe(2004);
    expect(ocsf.category_uid).toBe(2);
  });

  it("computes type_uid = class_uid * 100 + activity_id", () => {
    const ocsf = toOcsf(sampleEvent());
    expect(ocsf.type_uid).toBe(200401);
    expect(ocsf.activity_id).toBe(1);
  });

  it("maps Critical severity to 5, not 6", () => {
    const ocsf = toOcsf(sampleEvent({ decision: { ...sampleEvent().decision, severity: "critical" } }));
    expect(ocsf.severity_id).toBe(5);
    expect(ocsf.severity_id).not.toBe(6);
  });

  it("maps all severity levels correctly", () => {
    const cases: Array<{ input: SecurityEvent["decision"]["severity"]; expected: number }> = [
      { input: "info", expected: 1 },
      { input: "low", expected: 2 },
      { input: "medium", expected: 3 },
      { input: "high", expected: 4 },
      { input: "critical", expected: 5 },
    ];

    for (const { input, expected } of cases) {
      const event = sampleEvent({ decision: { ...sampleEvent().decision, severity: input } });
      const ocsf = toOcsf(event);
      expect(ocsf.severity_id).toBe(expected);
    }
  });

  it("maps denied action correctly", () => {
    const ocsf = toOcsf(sampleEvent());
    expect(ocsf.action_id).toBe(2); // Denied
    expect(ocsf.disposition_id).toBe(2); // Blocked
    expect(ocsf.status_id).toBe(2); // Failure
  });

  it("maps allowed action correctly", () => {
    const event = sampleEvent({
      outcome: "success",
      decision: { allowed: true, guard: "EgressGuard", severity: "info", reason: "OK" },
    });
    const ocsf = toOcsf(event);
    expect(ocsf.action_id).toBe(1); // Allowed
    expect(ocsf.disposition_id).toBe(1); // Allowed
    expect(ocsf.status_id).toBe(1); // Success
  });

  it("includes OCSF v1.4.0 metadata", () => {
    const ocsf = toOcsf(sampleEvent());
    const metadata = ocsf.metadata as Record<string, unknown>;
    expect(metadata.version).toBe("1.4.0");

    const product = metadata.product as Record<string, unknown>;
    expect(product.name).toBe("ClawdStrike");
    expect(product.uid).toBe("clawdstrike");
    expect(product.vendor_name).toBe("Backbay Labs");
  });

  it("includes finding_info with analytic type_id=1 (Rule)", () => {
    const ocsf = toOcsf(sampleEvent());
    const findingInfo = ocsf.finding_info as Record<string, unknown>;
    expect(findingInfo.uid).toBe("evt-ocsf-001");
    expect(findingInfo.title).toContain("ForbiddenPathGuard");

    const analytic = findingInfo.analytic as Record<string, unknown>;
    expect(analytic.name).toBe("ForbiddenPathGuard");
    expect(analytic.type_id).toBe(1);
    expect(analytic.type).toBe("Rule");
  });

  it("uses epoch milliseconds for time", () => {
    const ocsf = toOcsf(sampleEvent());
    expect(typeof ocsf.time).toBe("number");
    expect(ocsf.time).toBe(new Date("2024-03-02T12:00:00.000Z").getTime());
  });

  it("throws on invalid timestamp", () => {
    const event = sampleEvent({ timestamp: "not-a-date" });
    expect(() => toOcsf(event)).toThrow("Invalid SecurityEvent timestamp");
  });

  it("matches golden fixture schema fields for deny", () => {
    const fixture = loadFixture("detection_finding_deny.json");
    const event = sampleEvent({
      event_id: "evt-deny-001",
      timestamp: "2024-03-02T00:00:00.000Z",
    });
    const ocsf = toOcsf(event);

    // Schema-level fields must match
    expect(ocsf.class_uid).toBe(fixture.class_uid);
    expect(ocsf.category_uid).toBe(fixture.category_uid);
    expect(ocsf.type_uid).toBe(fixture.type_uid);
    expect(ocsf.activity_id).toBe(fixture.activity_id);
    expect(ocsf.severity_id).toBe(fixture.severity_id);
    expect(ocsf.action_id).toBe(fixture.action_id);
    expect(ocsf.disposition_id).toBe(fixture.disposition_id);
  });

  it("maps warn disposition to Logged (17)", () => {
    const event = sampleEvent({
      event_type: "guard_warn",
      outcome: "success",
      decision: { allowed: true, guard: "ShellCommandGuard", severity: "medium", reason: "risky command" },
    });
    const ocsf = toOcsf(event);
    expect(ocsf.action_id).toBe(1); // Allowed (non-blocking)
    expect(ocsf.disposition_id).toBe(17); // Logged
  });

  it("does not use deprecated class 2001", () => {
    const ocsf = toOcsf(sampleEvent());
    expect(ocsf.class_uid).not.toBe(2001);
  });
});
