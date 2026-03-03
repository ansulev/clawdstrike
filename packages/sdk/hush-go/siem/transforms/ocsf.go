package transforms

import (
	"fmt"

	"github.com/backbay-labs/clawdstrike-go/siem"
)

// OCSF Detection Finding class constants.
const (
	ocsfClassUID      = 2004 // Detection Finding (NOT deprecated 2001 Security Finding)
	ocsfCategoryUID   = 2    // Findings
	ocsfActivityCreate = 1   // Create
	ocsfTypeUID       = ocsfClassUID*100 + ocsfActivityCreate // 200401
	ocsfVersion       = "1.4.0"
)

// outcomeToOCSF maps Clawdstrike outcomes to OCSF status IDs.
var outcomeToOCSF = map[string]int{
	"allow": 1, // Success
	"deny":  2, // Failure
	"warn":  0, // Unknown
}

// severityToOCSF maps severity strings to OCSF severity IDs.
// Critical = 5 (NOT 6 which is Fatal).
var severityToOCSF = map[string]int{
	"info":     1,
	"low":      2,
	"warning":  3,
	"warn":     3,
	"medium":   3,
	"error":    4,
	"high":     4,
	"critical": 5,
}

// severityLabels maps severity IDs to OCSF label strings.
var severityLabels = map[int]string{
	0:  "Unknown",
	1:  "Informational",
	2:  "Low",
	3:  "Medium",
	4:  "High",
	5:  "Critical",
	6:  "Fatal",
	99: "Other",
}

// ToOCSF converts a SecurityEvent to OCSF v1.4.0 Detection Finding format.
func ToOCSF(event siem.SecurityEvent) map[string]interface{} {
	statusID := 0
	if id, ok := outcomeToOCSF[event.Outcome]; ok {
		statusID = id
	}

	actionID := 1     // Allowed
	dispositionID := 1 // Allowed
	switch event.Outcome {
	case "deny":
		actionID = 2      // Denied
		dispositionID = 2 // Blocked
	case "warn":
		actionID = 1       // Allowed (warn is non-blocking)
		dispositionID = 17 // Logged
	}

	ocsf := map[string]interface{}{
		"class_uid":      ocsfClassUID,
		"category_uid":   ocsfCategoryUID,
		"type_uid":       ocsfTypeUID,
		"activity_id":    ocsfActivityCreate,
		"activity_name":  "Create",
		"time":           event.Timestamp.UnixMilli(),
		"status_id":      statusID,
		"action_id":      actionID,
		"disposition_id": dispositionID,
		"message":        event.EventType,
		"metadata": map[string]interface{}{
			"version": ocsfVersion,
			"product": map[string]string{
				"name":        "ClawdStrike",
				"uid":         "clawdstrike",
				"vendor_name": "Backbay Labs",
				// Note: AgentInfo has no Version field; omit rather than use wrong value.
			},
			"original_uid": event.EventID,
		},
		"actor": map[string]interface{}{
			"user": map[string]interface{}{
				"uid":  event.Agent.ID,
				"name": event.Agent.Name,
			},
			"app_name": "clawdstrike",
		},
	}

	sevID := 0
	guardName := "unknown"
	guardMessage := event.EventType
	if event.Decision != nil {
		if id, ok := severityToOCSF[event.Decision.Severity]; ok {
			sevID = id
		}
		guardName = event.Decision.Guard
		guardMessage = event.Decision.Message
	}
	ocsf["severity_id"] = sevID
	ocsf["severity"] = severityLabels[sevID]
	ocsf["finding_info"] = map[string]interface{}{
		"uid":   event.EventID,
		"title": fmt.Sprintf("%s decision", guardName),
		"analytic": map[string]interface{}{
			"name":    guardName,
			"type_id": 1,
			"type":    "Rule",
		},
		"desc": guardMessage,
	}

	if event.Resource != nil {
		resources := []map[string]interface{}{
			{
				"type": event.Resource.Type,
				"name": resourceName(event.Resource),
			},
		}
		ocsf["resources"] = resources
	}

	return ocsf
}

func resourceName(r *siem.ResourceInfo) string {
	switch r.Type {
	case "file":
		return r.Path
	case "network":
		return r.Host
	case "tool":
		return r.Tool
	default:
		return ""
	}
}
