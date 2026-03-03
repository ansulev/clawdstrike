import type { SecurityEvent } from "../types";

const OCSF_VERSION = "1.4.0";

function ocsfSeverityId(sev: SecurityEvent["decision"]["severity"]): number {
  switch (sev) {
    case "info":
      return 1; // Informational
    case "low":
      return 2;
    case "medium":
      return 3;
    case "high":
      return 4;
    case "critical":
      return 5; // Critical = 5, NOT 6 (Fatal)
    default: {
      const exhaustive: never = sev;
      return exhaustive;
    }
  }
}

function ocsfSeverityLabel(sev: SecurityEvent["decision"]["severity"]): string {
  switch (sev) {
    case "info":
      return "Informational";
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "critical":
      return "Critical";
    default: {
      const exhaustive: never = sev;
      return exhaustive;
    }
  }
}

/**
 * Convert a SecurityEvent to an OCSF Detection Finding (class_uid=2004).
 *
 * OCSF v1.4.0 compliant with proper class_uid, category_uid, type_uid,
 * action_id, disposition_id, finding_info, and corrected severity mapping.
 */
export function toOcsf(event: SecurityEvent): Record<string, unknown> {
  const severityId = ocsfSeverityId(event.decision.severity);
  const severityLabel = ocsfSeverityLabel(event.decision.severity);
  const isWarn = event.event_type === "guard_warn";
  const actionId = isWarn ? 1 : event.decision.allowed ? 1 : 2; // 1=Allowed, 2=Denied
  const dispositionId = isWarn ? 17 : event.decision.allowed ? 1 : 2; // 17=Logged, 1=Allowed, 2=Blocked
  const statusId =
    event.outcome === "success" ? 1 : event.outcome === "failure" ? 2 : 0;

  const activityId = 1; // Create
  const classUid = 2004; // Detection Finding

  return {
    class_uid: classUid,
    category_uid: 2, // Findings
    type_uid: classUid * 100 + activityId,
    activity_id: activityId,
    activity_name: "Create",
    time: new Date(event.timestamp).getTime(),
    severity_id: severityId,
    severity: severityLabel,
    status_id: statusId,
    action_id: actionId,
    disposition_id: dispositionId,
    message: event.decision.reason,
    metadata: {
      version: OCSF_VERSION,
      product: {
        name: "ClawdStrike",
        uid: "clawdstrike",
        vendor_name: "Backbay Labs",
        version: event.agent.version,
      },
      original_uid: event.event_id,
    },
    finding_info: {
      uid: event.event_id,
      title: `${event.decision.guard} decision`,
      analytic: {
        name: event.decision.guard,
        type_id: 1, // Rule
        type: "Rule",
      },
      desc: event.decision.reason,
    },
    actor: {
      user: {
        name: event.agent.name,
        uid: event.agent.id,
      },
      app_name: "clawdstrike",
      session: event.session.id ? { uid: event.session.id } : undefined,
    },
    resources: [
      {
        name: event.resource.name,
        type: event.resource.type,
      },
    ],
  };
}
