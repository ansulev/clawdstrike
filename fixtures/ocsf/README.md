# OCSF Golden Fixtures

Golden fixture files for OCSF v1.4.0 compliance testing across Rust, TypeScript, and Go SDKs.

## Files

| File | OCSF Class | class_uid | Description |
|------|-----------|-----------|-------------|
| `detection_finding_allow.json` | Detection Finding | 2004 | Allowed guard decision |
| `detection_finding_deny.json` | Detection Finding | 2004 | Denied guard decision (Critical severity) |
| `process_activity_exec.json` | Process Activity | 1007 | Tetragon process exec event |
| `network_activity_egress.json` | Network Activity | 4001 | Hubble forwarded egress flow |
| `file_activity_write.json` | File Activity | 1001 | File write blocked |

## Cross-Language Parity

All SDKs are tested against these fixtures. Schema-level fields must match exactly:

- `class_uid`, `category_uid`, `type_uid`
- `activity_id`, `severity_id`, `status_id`
- `action_id`, `disposition_id`
- `metadata.version`, `metadata.product.name`, `metadata.product.vendor_name`
- `finding_info.analytic.type_id`

Non-deterministic fields (time, uid) are validated for type correctness only.

## Key Invariants

- `type_uid = class_uid * 100 + activity_id`
- `severity_id` for Critical = **5** (not 6/Fatal)
- `metadata.version` = "1.4.0"
- `finding_info.analytic.type_id` = 1 (Rule) for all policy-based detections
