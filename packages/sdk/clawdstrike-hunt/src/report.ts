import {
  MerkleTree,
  MerkleProof,
  canonicalize,
  toHex,
  fromHex,
  signMessage,
  verifySignature,
  hashLeaf,
  getBackend,
} from "@clawdstrike/sdk";
import { ReportError } from "./errors.js";
import type {
  Alert,
  EvidenceItem,
  HuntReport,
  IocMatch,
  TimelineEvent,
} from "./types.js";

/**
 * Build a hunt report from evidence items.
 *
 * Each item is serialized to canonical JSON (RFC 8785), then included as a
 * Merkle tree leaf. The resulting report contains the tree root and an
 * inclusion proof for every item.
 */
export function buildReport(title: string, items: EvidenceItem[]): HuntReport {
  if (items.length === 0) {
    throw new ReportError("no evidence items provided");
  }

  // Serialize each item to canonical JSON bytes.
  const encoder = new TextEncoder();
  const canonicalLeaves: Uint8Array[] = items.map((item) => {
    const val = itemToJsonValue(item);
    const canonical = canonicalize(val);
    return encoder.encode(canonical);
  });

  // Build the Merkle tree from raw data (will hash leaves internally).
  const tree = MerkleTree.fromData(canonicalLeaves);
  const root = tree.root;

  // Generate inclusion proofs.
  const proofs: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const proof = tree.inclusionProof(i);
    proofs.push(JSON.stringify(proof.toJSON()));
  }

  return {
    title,
    generatedAt: new Date(),
    evidence: items,
    merkleRoot: toHex(root),
    merkleProofs: proofs,
  };
}

/**
 * Sign a report's Merkle root with an Ed25519 key (hex-encoded seed).
 */
export async function signReport(
  report: HuntReport,
  signingKeyHex: string
): Promise<void> {
  const seed = fromHex(signingKeyHex);
  const rootBytes = fromHex(report.merkleRoot);

  const signature = await signMessage(rootBytes, seed);
  const publicKey = await getBackend().publicKeyFromPrivate(seed);

  report.signature = toHex(signature);
  report.signer = toHex(publicKey);
}

/**
 * Verify a report's signature and Merkle proofs.
 */
export async function verifyReport(report: HuntReport): Promise<boolean> {
  const rootBytes = fromHex(report.merkleRoot);

  // Verify signature if present.
  if (report.signature !== undefined && report.signer !== undefined) {
    const sig = fromHex(report.signature);
    const pubKey = fromHex(report.signer);
    const valid = await verifySignature(rootBytes, sig, pubKey);
    if (!valid) return false;
  } else if (
    (report.signature !== undefined && report.signer === undefined) ||
    (report.signature === undefined && report.signer !== undefined)
  ) {
    // Mismatched: one field present without the other.
    return false;
  }

  // Verify each evidence item's Merkle proof.
  if (report.merkleProofs.length !== report.evidence.length) {
    throw new ReportError("proof count does not match evidence count");
  }

  for (let i = 0; i < report.evidence.length; i++) {
    const item = report.evidence[i];
    const val = itemToJsonValue(item);
    const canonical = canonicalize(val);
    const leafBytes = new TextEncoder().encode(canonical);
    const leafHash = hashLeaf(leafBytes);

    const proofJson = JSON.parse(report.merkleProofs[i]) as {
      treeSize: number;
      leafIndex: number;
      auditPath: string[];
    };

    const proof = MerkleProof.fromJSON(proofJson);
    if (!proof.verify(leafHash, rootBytes)) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Evidence conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert an Alert into EvidenceItems.
 * The alert itself becomes one item; each evidence event becomes another.
 */
export function evidenceFromAlert(alert: Alert, startIndex: number): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  items.push({
    index: startIndex,
    sourceType: "alert",
    timestamp: alert.triggeredAt,
    summary: `[${alert.severity}] ${alert.ruleName}: ${alert.title}`,
    data: {
      ruleName: alert.ruleName,
      severity: alert.severity,
      title: alert.title,
      triggeredAt: alert.triggeredAt.toISOString(),
      description: alert.description,
    },
  });

  for (let i = 0; i < alert.evidence.length; i++) {
    const event = alert.evidence[i];
    items.push({
      index: startIndex + 1 + i,
      sourceType: "event",
      timestamp: event.timestamp,
      summary: `[${event.source}] ${event.summary}`,
      data: eventToData(event),
    });
  }

  return items;
}

/**
 * Convert timeline events into EvidenceItems.
 */
export function evidenceFromEvents(
  events: TimelineEvent[],
  startIndex: number
): EvidenceItem[] {
  return events.map((event, i) => ({
    index: startIndex + i,
    sourceType: "event",
    timestamp: event.timestamp,
    summary: `[${event.source}] ${event.summary}`,
    data: eventToData(event),
  }));
}

/**
 * Convert IOC matches into EvidenceItems.
 */
export function evidenceFromIocMatches(
  matches: IocMatch[],
  startIndex: number
): EvidenceItem[] {
  return matches.map((m, i) => {
    const iocNames = m.matchedIocs.map((e) => e.indicator);
    return {
      index: startIndex + i,
      sourceType: "ioc_match",
      timestamp: m.event.timestamp,
      summary: `IOC match in ${m.matchField}: ${iocNames.join(", ")} (${m.event.summary})`,
      data: {
        event: eventToData(m.event),
        matchedIocs: m.matchedIocs,
        matchField: m.matchField,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function eventToData(event: TimelineEvent): Record<string, unknown> {
  return {
    timestamp: event.timestamp.toISOString(),
    source: event.source,
    kind: event.kind,
    verdict: event.verdict,
    severity: event.severity,
    summary: event.summary,
    process: event.process,
    namespace: event.namespace,
    pod: event.pod,
    actionType: event.actionType,
    signatureValid: event.signatureValid,
    raw: event.raw,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function itemToJsonValue(item: EvidenceItem): any {
  return {
    index: item.index,
    sourceType: item.sourceType,
    timestamp:
      item.timestamp instanceof Date
        ? item.timestamp.toISOString()
        : String(item.timestamp),
    summary: item.summary,
    data: item.data,
  };
}
