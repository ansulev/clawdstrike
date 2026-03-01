import type { TimelineEvent } from './types.js';
import {
  EventSourceType,
  NormalizedVerdict,
  TimelineEventKind,
} from './types.js';

/**
 * Parse a spine envelope JSON object into a TimelineEvent.
 * Dispatches on fact.schema to determine the event source.
 * Returns undefined for unrecognized or invalid envelopes.
 */
export function parseEnvelope(envelope: unknown): TimelineEvent | undefined {
  if (typeof envelope !== 'object' || envelope === null) {
    return undefined;
  }
  const env = envelope as Record<string, unknown>;

  const fact = env.fact;
  if (typeof fact !== 'object' || fact === null) {
    return undefined;
  }
  const f = fact as Record<string, unknown>;

  const schema = f.schema;
  if (typeof schema !== 'string') {
    return undefined;
  }

  // Parse timestamp from issued_at
  const issuedAt = env.issued_at;
  if (typeof issuedAt !== 'string') {
    return undefined;
  }
  const timestamp = new Date(issuedAt);
  if (isNaN(timestamp.getTime())) {
    return undefined;
  }

  if (schema === 'clawdstrike.sdr.fact.tetragon_event.v1') {
    return parseTetragon(f, timestamp, envelope);
  }
  if (schema === 'clawdstrike.sdr.fact.hubble_flow.v1') {
    return parseHubble(f, timestamp, envelope);
  }
  if (schema.startsWith('clawdstrike.sdr.fact.receipt')) {
    return parseReceipt(f, timestamp, envelope);
  }
  if (schema.startsWith('clawdstrike.sdr.fact.scan')) {
    return parseScan(f, timestamp, envelope);
  }

  return undefined;
}

function str(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

function obj(val: unknown): Record<string, unknown> | undefined {
  return typeof val === 'object' && val !== null
    ? (val as Record<string, unknown>)
    : undefined;
}

function parseTetragon(
  fact: Record<string, unknown>,
  timestamp: Date,
  raw: unknown,
): TimelineEvent {
  const eventType = str(fact.event_type) ?? 'unknown';
  const proc = obj(fact.process);
  const binary = proc ? str(proc.binary) : undefined;
  const severity = str(fact.severity);
  const pod = proc ? obj(proc.pod) : undefined;
  const ns = pod ? str(pod.namespace) : undefined;
  const podName = pod ? str(pod.name) : undefined;

  let kind: TimelineEvent['kind'];
  switch (eventType) {
    case 'PROCESS_EXEC':
      kind = TimelineEventKind.ProcessExec;
      break;
    case 'PROCESS_EXIT':
      kind = TimelineEventKind.ProcessExit;
      break;
    case 'PROCESS_KPROBE':
      kind = TimelineEventKind.ProcessKprobe;
      break;
    default:
      kind = TimelineEventKind.ProcessExec;
      break;
  }

  const summary = `${eventType.toLowerCase()} ${binary ?? '?'}`;

  return {
    timestamp,
    source: EventSourceType.Tetragon,
    kind,
    verdict: NormalizedVerdict.None,
    severity,
    summary,
    process: binary,
    namespace: ns,
    pod: podName,
    actionType: 'process',
    raw,
  };
}

function parseHubble(
  fact: Record<string, unknown>,
  timestamp: Date,
  raw: unknown,
): TimelineEvent {
  const verdictStr = str(fact.verdict) ?? 'UNKNOWN';
  const direction = str(fact.traffic_direction) ?? 'unknown';
  const flowSummary = str(fact.summary) ?? 'network flow';

  let verdict: TimelineEvent['verdict'];
  switch (verdictStr) {
    case 'FORWARDED':
      verdict = NormalizedVerdict.Forwarded;
      break;
    case 'DROPPED':
      verdict = NormalizedVerdict.Dropped;
      break;
    default:
      verdict = NormalizedVerdict.None;
      break;
  }

  const source = obj(fact.source);
  const ns = source ? str(source.namespace) : undefined;
  const podName = source ? str(source.pod_name) : undefined;

  let actionType: string;
  switch (direction) {
    case 'EGRESS':
      actionType = 'egress';
      break;
    case 'INGRESS':
      actionType = 'ingress';
      break;
    default:
      actionType = 'network';
      break;
  }

  const summary = `${direction.toLowerCase()} ${flowSummary}`;

  return {
    timestamp,
    source: EventSourceType.Hubble,
    kind: TimelineEventKind.NetworkFlow,
    verdict,
    summary,
    namespace: ns,
    pod: podName,
    actionType,
    raw,
  };
}

function parseReceipt(
  fact: Record<string, unknown>,
  timestamp: Date,
  raw: unknown,
): TimelineEvent {
  const decision = str(fact.decision) ?? 'unknown';
  const guardName = str(fact.guard) ?? 'unknown';
  const action = str(fact.action_type);
  const severity = str(fact.severity);
  const source = obj(fact.source);
  const ns = source ? str(source.namespace) : undefined;
  const podName = source
    ? str(source.pod_name) ?? str(source.pod)
    : undefined;

  let verdict: TimelineEvent['verdict'];
  switch (decision.toLowerCase()) {
    case 'allow':
    case 'allowed':
    case 'pass':
    case 'passed':
      verdict = NormalizedVerdict.Allow;
      break;
    case 'deny':
    case 'denied':
    case 'block':
    case 'blocked':
      verdict = NormalizedVerdict.Deny;
      break;
    case 'warn':
    case 'warned':
    case 'warning':
      verdict = NormalizedVerdict.Warn;
      break;
    default:
      verdict = NormalizedVerdict.None;
      break;
  }

  const summary = `${guardName} decision=${decision}`;

  return {
    timestamp,
    source: EventSourceType.Receipt,
    kind: TimelineEventKind.GuardDecision,
    verdict,
    severity,
    summary,
    namespace: ns,
    pod: podName,
    actionType: action,
    raw,
  };
}

function parseScan(
  fact: Record<string, unknown>,
  timestamp: Date,
  raw: unknown,
): TimelineEvent {
  const scanType = str(fact.scan_type) ?? 'unknown';
  const status = str(fact.status) ?? 'unknown';
  const severity = str(fact.severity);

  let verdict: TimelineEvent['verdict'];
  switch (status.toLowerCase()) {
    case 'pass':
    case 'passed':
    case 'clean':
      verdict = NormalizedVerdict.Allow;
      break;
    case 'fail':
    case 'failed':
    case 'dirty':
      verdict = NormalizedVerdict.Deny;
      break;
    case 'warn':
    case 'warning':
      verdict = NormalizedVerdict.Warn;
      break;
    default:
      verdict = NormalizedVerdict.None;
      break;
  }

  const summary = `scan ${scanType} status=${status}`;

  return {
    timestamp,
    source: EventSourceType.Scan,
    kind: TimelineEventKind.ScanResult,
    verdict,
    severity,
    summary,
    actionType: 'scan',
    raw,
  };
}

/** Sort events by timestamp ascending. */
export function mergeTimeline(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
}
