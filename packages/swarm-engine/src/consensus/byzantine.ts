/**
 * Byzantine Fault Tolerant Consensus (PBFT)
 *
 * PBFT-style consensus for handling malicious or faulty nodes.
 * Ported from ruflo v3 with TypedEventEmitter injection (no Node.js EventEmitter).
 *
 * Transforms applied:
 * - EventEmitter removed, TypedEventEmitter<SwarmEngineEventMap> injected via constructor
 * - NodeJS.Timeout -> ReturnType<typeof setTimeout> | null
 * - Date objects -> number (Unix ms via Date.now())
 * - proposal.votes: Map internal, ConsensusVote[] on public boundary
 * - generateSwarmId("csn") for proposal IDs
 * - Typed event emission (consensus.proposed, consensus.vote_cast, consensus.resolved, topology.leader_elected)
 * - Quorum: 2f+1 where f = floor((nodeCount-1)/3)
 *
 * @module
 */

import type { TypedEventEmitter, SwarmEngineEventMap } from "../events.js";
import type {
  ConsensusProposal,
  ConsensusVote,
  ConsensusResult,
} from "../types.js";
import { SWARM_ENGINE_CONSTANTS } from "../types.js";
import { generateSwarmId } from "../ids.js";

// ============================================================================
// Types
// ============================================================================

export type ByzantinePhase =
  | "idle"
  | "pre-prepare"
  | "prepare"
  | "commit";

export interface ByzantineMessage {
  type: ByzantinePhase;
  viewNumber: number;
  sequenceNumber: number;
  digest: string;
  senderId: string;
  timestamp: number;
  payload?: Record<string, unknown>;
  signature?: string;
}

export interface ByzantineNode {
  id: string;
  isPrimary: boolean;
  viewNumber: number;
  sequenceNumber: number;
  preparedMessages: Map<string, ByzantineMessage[]>;
  committedMessages: Map<string, ByzantineMessage[]>;
}

export interface ByzantineConfig {
  threshold?: number;
  timeoutMs?: number;
  maxRounds?: number;
  requireQuorum?: boolean;
  maxFaultyNodes?: number;
  viewChangeTimeoutMs?: number;
}

// ============================================================================
// ByzantineConsensus
// ============================================================================

export class ByzantineConsensus {
  private readonly events: TypedEventEmitter<SwarmEngineEventMap>;
  private readonly config: Required<ByzantineConfig>;
  private readonly node: ByzantineNode;
  private readonly nodes: Map<string, ByzantineNode> = new Map();
  private readonly proposals: Map<string, ConsensusProposal> = new Map();
  /** Internal vote tracking: Map for O(1) dedup. */
  private readonly proposalVotes: Map<string, Map<string, ConsensusVote>> =
    new Map();
  private readonly messageLog: Map<string, ByzantineMessage[]> = new Map();
  private viewChangeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    events: TypedEventEmitter<SwarmEngineEventMap>,
    nodeId: string,
    config?: ByzantineConfig,
  ) {
    this.events = events;
    this.config = {
      threshold:
        config?.threshold ?? SWARM_ENGINE_CONSTANTS.DEFAULT_CONSENSUS_THRESHOLD,
      timeoutMs:
        config?.timeoutMs ??
        SWARM_ENGINE_CONSTANTS.DEFAULT_CONSENSUS_TIMEOUT_MS,
      maxRounds: config?.maxRounds ?? 10,
      requireQuorum: config?.requireQuorum ?? true,
      maxFaultyNodes: config?.maxFaultyNodes ?? 1,
      viewChangeTimeoutMs: config?.viewChangeTimeoutMs ?? 5000,
    };

    this.node = {
      id: nodeId,
      isPrimary: false,
      viewNumber: 0,
      sequenceNumber: 0,
      preparedMessages: new Map(),
      committedMessages: new Map(),
    };
  }

  // ===== PUBLIC API =====

  initialize(): void {
    // Byzantine consensus starts in idle state; primary elected explicitly
  }

  addNode(nodeId: string, isPrimary: boolean = false): void {
    this.nodes.set(nodeId, {
      id: nodeId,
      isPrimary,
      viewNumber: 0,
      sequenceNumber: 0,
      preparedMessages: new Map(),
      committedMessages: new Map(),
    });

    if (isPrimary && this.node.id === nodeId) {
      this.node.isPrimary = true;
    }
  }

  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  electPrimary(): string {
    const nodeIds = [this.node.id, ...Array.from(this.nodes.keys())];
    const primaryIndex = this.node.viewNumber % nodeIds.length;
    const primaryId = nodeIds[primaryIndex]!;

    this.node.isPrimary = primaryId === this.node.id;

    for (const [id, node] of this.nodes) {
      node.isPrimary = id === primaryId;
    }

    const electionStart = Date.now();

    this.events.emit("topology.leader_elected", {
      kind: "topology.leader_elected",
      sourceAgentId: primaryId,
      timestamp: Date.now(),
      leaderId: primaryId,
      term: this.node.viewNumber,
      electionDurationMs: Date.now() - electionStart,
    });

    return primaryId;
  }

  propose(value: Record<string, unknown>): ConsensusProposal {
    if (!this.node.isPrimary) {
      throw new Error("Only primary can propose values");
    }

    const sequenceNumber = ++this.node.sequenceNumber;
    const digest = this.computeDigest(value);
    const proposalId = generateSwarmId("csn");

    // Internal vote map for O(1) dedup
    const voteMap = new Map<string, ConsensusVote>();
    this.proposalVotes.set(proposalId, voteMap);

    const proposal: ConsensusProposal = {
      id: proposalId,
      proposerId: this.node.id,
      value,
      term: this.node.viewNumber,
      timestamp: Date.now(),
      votes: [],
      status: "pending",
    };

    this.proposals.set(proposalId, proposal);

    // Phase 1: Pre-prepare
    const prePrepareMsg: ByzantineMessage = {
      type: "pre-prepare",
      viewNumber: this.node.viewNumber,
      sequenceNumber,
      digest,
      senderId: this.node.id,
      timestamp: Date.now(),
      payload: value,
    };

    this.broadcastMessage(prePrepareMsg);

    // Self-prepare
    this.handlePrepare({
      type: "prepare",
      viewNumber: this.node.viewNumber,
      sequenceNumber,
      digest,
      senderId: this.node.id,
      timestamp: Date.now(),
    });

    // Emit typed event
    this.events.emit("consensus.proposed", {
      kind: "consensus.proposed",
      sourceAgentId: this.node.id,
      timestamp: Date.now(),
      proposal,
    });

    return proposal;
  }

  vote(
    proposalId: string,
    approve: boolean,
    confidence?: number,
    voterId?: string,
  ): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== "pending") {
      return;
    }

    const voteMap =
      this.proposalVotes.get(proposalId) ?? new Map<string, ConsensusVote>();
    if (!this.proposalVotes.has(proposalId)) {
      this.proposalVotes.set(proposalId, voteMap);
    }

    const vote: ConsensusVote = {
      voterId: voterId ?? this.node.id,
      approve,
      confidence: confidence ?? 1.0,
      timestamp: Date.now(),
    };

    voteMap.set(vote.voterId, vote);
    proposal.votes = Array.from(voteMap.values());

    // Emit vote_cast event
    this.events.emit("consensus.vote_cast", {
      kind: "consensus.vote_cast",
      sourceAgentId: vote.voterId,
      timestamp: Date.now(),
      proposalId,
      vote,
    });

    // Check consensus using PBFT quorum (2f+1)
    const f = this.getMaxFaultyNodes();
    const requiredVotes = 2 * f + 1;

    const approvingVotes = Array.from(voteMap.values()).filter(
      (v) => v.approve,
    ).length;
    const n = this.nodes.size + 1;

    if (approvingVotes >= requiredVotes) {
      proposal.status = "accepted";
      proposal.votes = Array.from(voteMap.values());
      this.emitResolved(proposal);
    } else if (voteMap.size >= n && approvingVotes < requiredVotes) {
      proposal.status = "rejected";
      proposal.votes = Array.from(voteMap.values());
      this.emitResolved(proposal);
    }
  }

  awaitConsensus(proposalId: string): Promise<ConsensusResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const proposal = this.proposals.get(proposalId);
      if (!proposal) {
        reject(new Error(`Proposal ${proposalId} not found`));
        return;
      }

      // Already resolved
      if (proposal.status !== "pending") {
        resolve(this.createResult(proposal, Date.now() - startTime));
        return;
      }

      // Event-driven resolution instead of setInterval polling
      const cleanup = this.events.on("consensus.resolved", (event) => {
        if (event.result.proposalId === proposalId) {
          cleanup();
          if (timer !== null) {
            clearTimeout(timer);
          }
          resolve(event.result);
        }
      });

      // Timeout fallback
      const timer = setTimeout(() => {
        cleanup();
        const p = this.proposals.get(proposalId);
        if (p && p.status === "pending") {
          p.status = "expired";
          resolve(this.createResult(p, Date.now() - startTime));
        }
      }, this.config.timeoutMs);
    });
  }

  // ===== MESSAGE HANDLERS =====

  handlePrePrepare(message: ByzantineMessage): void {
    if (message.viewNumber !== this.node.viewNumber) {
      return;
    }

    // Accept pre-prepare from primary -- find or create proposal
    // Check if we have a proposal for this sequence
    let proposal: ConsensusProposal | undefined;
    for (const p of this.proposals.values()) {
      if (p.term === message.viewNumber && p.proposerId === message.senderId) {
        proposal = p;
        break;
      }
    }

    if (!proposal && message.payload !== undefined) {
      const proposalId = generateSwarmId("csn");
      proposal = {
        id: proposalId,
        proposerId: message.senderId,
        value: message.payload,
        term: message.viewNumber,
        timestamp: message.timestamp,
        votes: [],
        status: "pending",
      };
      this.proposals.set(proposalId, proposal);
      this.proposalVotes.set(proposalId, new Map());
    }

    // Send prepare message
    const prepareMsg: ByzantineMessage = {
      type: "prepare",
      viewNumber: message.viewNumber,
      sequenceNumber: message.sequenceNumber,
      digest: message.digest,
      senderId: this.node.id,
      timestamp: Date.now(),
    };

    this.broadcastMessage(prepareMsg);
    this.handlePrepare(prepareMsg);
  }

  handlePrepare(message: ByzantineMessage): void {
    const key = `${message.viewNumber}_${message.sequenceNumber}`;

    if (!this.messageLog.has(key)) {
      this.messageLog.set(key, []);
    }

    const messages = this.messageLog.get(key)!;
    const hasPrepare = messages.some(
      (m) => m.type === "prepare" && m.senderId === message.senderId,
    );

    if (!hasPrepare) {
      messages.push(message);
    }

    // Check if prepared (2f + 1 prepare messages)
    const f = this.getMaxFaultyNodes();
    const prepareCount = messages.filter((m) => m.type === "prepare").length;

    if (prepareCount >= 2 * f + 1) {
      this.node.preparedMessages.set(key, messages);

      // Send commit message
      const commitMsg: ByzantineMessage = {
        type: "commit",
        viewNumber: message.viewNumber,
        sequenceNumber: message.sequenceNumber,
        digest: message.digest,
        senderId: this.node.id,
        timestamp: Date.now(),
      };

      this.broadcastMessage(commitMsg);
      this.handleCommit(commitMsg);
    }
  }

  handleCommit(message: ByzantineMessage): void {
    const key = `${message.viewNumber}_${message.sequenceNumber}`;

    if (!this.messageLog.has(key)) {
      this.messageLog.set(key, []);
    }

    const messages = this.messageLog.get(key)!;
    const hasCommit = messages.some(
      (m) => m.type === "commit" && m.senderId === message.senderId,
    );

    if (!hasCommit) {
      messages.push(message);
    }

    // Check if committed (2f + 1 commit messages)
    const f = this.getMaxFaultyNodes();
    const commitCount = messages.filter((m) => m.type === "commit").length;

    if (commitCount >= 2 * f + 1) {
      this.node.committedMessages.set(key, messages);

      // Find and resolve the corresponding proposal
      for (const proposal of this.proposals.values()) {
        if (
          proposal.term === message.viewNumber &&
          proposal.status === "pending"
        ) {
          proposal.status = "accepted";
          const voteMap = this.proposalVotes.get(proposal.id);
          if (voteMap) {
            proposal.votes = Array.from(voteMap.values());
          }
          this.emitResolved(proposal);
          break;
        }
      }
    }
  }

  // ===== VIEW CHANGE =====

  initiateViewChange(): void {
    this.node.viewNumber++;
    this.electPrimary();
  }

  // ===== STATE QUERIES =====

  getIsPrimary(): boolean {
    return this.node.isPrimary;
  }

  getViewNumber(): number {
    return this.node.viewNumber;
  }

  getSequenceNumber(): number {
    return this.node.sequenceNumber;
  }

  getPreparedCount(): number {
    return this.node.preparedMessages.size;
  }

  getCommittedCount(): number {
    return this.node.committedMessages.size;
  }

  getMaxFaultyNodes(): number {
    const n = this.nodes.size + 1;
    return Math.floor((n - 1) / 3);
  }

  canTolerate(faultyCount: number): boolean {
    return faultyCount <= this.getMaxFaultyNodes();
  }

  getActiveProposals(): Record<string, ConsensusProposal> {
    const result: Record<string, ConsensusProposal> = {};
    for (const [id, proposal] of this.proposals) {
      if (proposal.status === "pending") {
        const voteMap = this.proposalVotes.get(id);
        if (voteMap) {
          proposal.votes = Array.from(voteMap.values());
        }
        result[id] = proposal;
      }
    }
    return result;
  }

  dispose(): void {
    if (this.viewChangeTimeout !== null) {
      clearTimeout(this.viewChangeTimeout);
      this.viewChangeTimeout = null;
    }
  }

  // ===== PRIVATE METHODS =====

  private broadcastMessage(_message: ByzantineMessage): void {
    // Broadcast to all registered nodes (in-process simulation).
    // In a real system, this would send over the network to each node.
  }

  private computeDigest(value: Record<string, unknown>): string {
    // Simple hash for demonstration
    const str = JSON.stringify(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private emitResolved(proposal: ConsensusProposal): void {
    const voteMap = this.proposalVotes.get(proposal.id);
    const n = this.nodes.size + 1;
    const approvingVotes = voteMap
      ? Array.from(voteMap.values()).filter((v) => v.approve).length
      : 0;

    const result: ConsensusResult = {
      proposalId: proposal.id,
      approved: proposal.status === "accepted",
      approvalRate:
        voteMap && voteMap.size > 0 ? approvingVotes / voteMap.size : 0,
      participationRate: voteMap ? voteMap.size / n : 0,
      finalValue: proposal.value,
      rounds: 3, // pre-prepare, prepare, commit
      durationMs: Date.now() - proposal.timestamp,
      receipt: null,
    };

    this.events.emit("consensus.resolved", {
      kind: "consensus.resolved",
      sourceAgentId: proposal.proposerId,
      timestamp: Date.now(),
      result,
    });
  }

  private createResult(
    proposal: ConsensusProposal,
    durationMs: number,
  ): ConsensusResult {
    const voteMap = this.proposalVotes.get(proposal.id);
    const n = this.nodes.size + 1;
    const approvingVotes = voteMap
      ? Array.from(voteMap.values()).filter((v) => v.approve).length
      : 0;

    return {
      proposalId: proposal.id,
      approved: proposal.status === "accepted",
      approvalRate:
        voteMap && voteMap.size > 0 ? approvingVotes / voteMap.size : 0,
      participationRate: voteMap ? voteMap.size / n : 0,
      finalValue: proposal.value,
      rounds: 3,
      durationMs,
      receipt: null,
    };
  }
}
