/**
 * Gossip Protocol Consensus
 *
 * Eventually consistent consensus for large-scale distributed systems.
 * Ported from ruflo v3 with TypedEventEmitter injection (no Node.js EventEmitter).
 *
 * Transforms applied:
 * - EventEmitter removed, TypedEventEmitter<SwarmEngineEventMap> injected via constructor
 * - NodeJS.Timeout -> ReturnType<typeof setInterval> | null
 * - Date objects -> number (Unix ms via Date.now())
 * - proposal.votes: Map internal, ConsensusVote[] on public boundary
 * - generateSwarmId("csn") for proposal IDs
 * - Typed event emission (consensus.proposed, consensus.vote_cast, consensus.resolved)
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

export interface GossipMessage {
  id: string;
  type: "proposal" | "vote" | "state" | "ack";
  senderId: string;
  version: number;
  payload: Record<string, unknown>;
  timestamp: number;
  ttl: number;
  hops: number;
  path: string[];
}

export interface GossipNode {
  id: string;
  state: Map<string, unknown>;
  version: number;
  neighbors: Set<string>;
  seenMessages: Set<string>;
  lastSync: number;
}

export interface GossipConfig {
  threshold?: number;
  timeoutMs?: number;
  maxRounds?: number;
  requireQuorum?: boolean;
  fanout?: number;
  gossipIntervalMs?: number;
  maxHops?: number;
  convergenceThreshold?: number;
}

// ============================================================================
// GossipConsensus
// ============================================================================

export class GossipConsensus {
  private readonly events: TypedEventEmitter<SwarmEngineEventMap>;
  private readonly config: Required<GossipConfig>;
  private readonly node: GossipNode;
  private readonly nodes: Map<string, GossipNode> = new Map();
  private readonly proposals: Map<string, ConsensusProposal> = new Map();
  /** Internal vote tracking: Map for O(1) dedup. */
  private readonly proposalVotes: Map<string, Map<string, ConsensusVote>> =
    new Map();
  private readonly messageQueue: GossipMessage[] = [];
  private gossipInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    events: TypedEventEmitter<SwarmEngineEventMap>,
    nodeId: string,
    config?: GossipConfig,
  ) {
    this.events = events;
    this.config = {
      threshold:
        config?.threshold ?? SWARM_ENGINE_CONSTANTS.DEFAULT_CONSENSUS_THRESHOLD,
      timeoutMs:
        config?.timeoutMs ??
        SWARM_ENGINE_CONSTANTS.DEFAULT_CONSENSUS_TIMEOUT_MS,
      maxRounds: config?.maxRounds ?? 10,
      requireQuorum: config?.requireQuorum ?? false, // Gossip is eventually consistent
      fanout: config?.fanout ?? 3,
      gossipIntervalMs: config?.gossipIntervalMs ?? 100,
      maxHops: config?.maxHops ?? 10,
      convergenceThreshold: config?.convergenceThreshold ?? 0.9,
    };

    this.node = {
      id: nodeId,
      state: new Map(),
      version: 0,
      neighbors: new Set(),
      seenMessages: new Set(),
      lastSync: Date.now(),
    };
  }

  // ===== PUBLIC API =====

  initialize(): void {
    this.startGossipLoop();
  }

  addNode(nodeId: string): void {
    this.nodes.set(nodeId, {
      id: nodeId,
      state: new Map(),
      version: 0,
      neighbors: new Set(),
      seenMessages: new Set(),
      lastSync: Date.now(),
    });

    // Add as neighbor with some probability (random mesh)
    if (Math.random() < 0.5) {
      this.node.neighbors.add(nodeId);
      this.nodes.get(nodeId)!.neighbors.add(this.node.id);
    }
  }

  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.node.neighbors.delete(nodeId);

    for (const node of this.nodes.values()) {
      node.neighbors.delete(nodeId);
    }
  }

  addNeighbor(nodeId: string): void {
    if (this.nodes.has(nodeId)) {
      this.node.neighbors.add(nodeId);
    }
  }

  removeNeighbor(nodeId: string): void {
    this.node.neighbors.delete(nodeId);
  }

  propose(value: Record<string, unknown>): ConsensusProposal {
    const proposalId = generateSwarmId("csn");

    // Internal vote map for O(1) dedup
    const voteMap = new Map<string, ConsensusVote>();
    this.proposalVotes.set(proposalId, voteMap);

    const proposal: ConsensusProposal = {
      id: proposalId,
      proposerId: this.node.id,
      value,
      term: this.node.version,
      timestamp: Date.now(),
      votes: [],
      status: "pending",
    };

    this.proposals.set(proposalId, proposal);

    // Self-vote
    const selfVote: ConsensusVote = {
      voterId: this.node.id,
      approve: true,
      confidence: 1.0,
      timestamp: Date.now(),
    };
    voteMap.set(this.node.id, selfVote);
    proposal.votes = Array.from(voteMap.values());

    // Create gossip message
    const message: GossipMessage = {
      id: `msg_${proposalId}`,
      type: "proposal",
      senderId: this.node.id,
      version: ++this.node.version,
      payload: { proposalId, value },
      timestamp: Date.now(),
      ttl: this.config.maxHops,
      hops: 0,
      path: [this.node.id],
    };

    // Queue for gossip
    this.queueMessage(message);

    // Emit typed event
    this.events.emit("consensus.proposed", {
      kind: "consensus.proposed",
      sourceAgentId: this.node.id,
      timestamp: Date.now(),
      proposal,
    });

    // Check if self-vote alone triggers convergence (e.g., single-node cluster)
    this.checkConvergence(proposalId);

    return proposal;
  }

  vote(
    proposalId: string,
    approve: boolean,
    confidence?: number,
  ): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return;
    }

    const voteMap =
      this.proposalVotes.get(proposalId) ?? new Map<string, ConsensusVote>();
    if (!this.proposalVotes.has(proposalId)) {
      this.proposalVotes.set(proposalId, voteMap);
    }

    // Derive voter identity from this node -- prevents vote spoofing
    const vote: ConsensusVote = {
      voterId: this.node.id,
      approve,
      confidence: confidence ?? 1.0,
      timestamp: Date.now(),
    };

    voteMap.set(vote.voterId, vote);
    proposal.votes = Array.from(voteMap.values());

    // Create vote gossip message
    const message: GossipMessage = {
      id: `vote_${proposalId}_${vote.voterId}`,
      type: "vote",
      senderId: this.node.id,
      version: ++this.node.version,
      payload: { proposalId, vote: vote as unknown as Record<string, unknown> },
      timestamp: Date.now(),
      ttl: this.config.maxHops,
      hops: 0,
      path: [this.node.id],
    };

    this.queueMessage(message);

    // Emit vote_cast event
    this.events.emit("consensus.vote_cast", {
      kind: "consensus.vote_cast",
      sourceAgentId: vote.voterId,
      timestamp: Date.now(),
      proposalId,
      vote,
    });

    // Check convergence
    this.checkConvergence(proposalId);
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
          // Gossip is eventually consistent: accept if convergence threshold met
          const totalNodes = this.nodes.size + 1;
          const voteMap = this.proposalVotes.get(proposalId);
          const votes = voteMap ? voteMap.size : 0;

          if (votes / totalNodes >= this.config.convergenceThreshold) {
            p.status = "accepted";
          } else {
            p.status = "expired";
          }

          resolve(this.createResult(p, Date.now() - startTime));
        }
      }, this.config.timeoutMs);
    });
  }

  // ===== STATE QUERIES =====

  getConvergence(proposalId: string): number {
    const voteMap = this.proposalVotes.get(proposalId);
    if (!voteMap) return 0;

    const totalNodes = this.nodes.size + 1;
    return voteMap.size / totalNodes;
  }

  getVersion(): number {
    return this.node.version;
  }

  getNeighborCount(): number {
    return this.node.neighbors.size;
  }

  getSeenMessageCount(): number {
    return this.node.seenMessages.size;
  }

  getQueueDepth(): number {
    return this.messageQueue.length;
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
    if (this.gossipInterval !== null) {
      clearInterval(this.gossipInterval);
      this.gossipInterval = null;
    }
  }

  // Anti-entropy: sync full state with a random neighbor
  antiEntropy(): void {
    if (this.node.neighbors.size === 0) return;

    const neighbors = Array.from(this.node.neighbors);
    const randomNeighbor =
      neighbors[Math.floor(Math.random() * neighbors.length)]!;

    const stateMessage: GossipMessage = {
      id: `state_${this.node.id}_${Date.now()}`,
      type: "state",
      senderId: this.node.id,
      version: this.node.version,
      payload: Object.fromEntries(this.node.state),
      timestamp: Date.now(),
      ttl: 1,
      hops: 0,
      path: [this.node.id],
    };

    this.sendToNeighbor(randomNeighbor, stateMessage);
  }

  // ===== GOSSIP PROTOCOL (PRIVATE) =====

  private startGossipLoop(): void {
    this.gossipInterval = setInterval(() => {
      this.gossipRound();
    }, this.config.gossipIntervalMs);
  }

  private gossipRound(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    // Select random neighbors (fanout)
    const fanout = Math.min(this.config.fanout, this.node.neighbors.size);
    const neighbors = this.selectRandomNeighbors(fanout);

    // Send queued messages to selected neighbors
    const messages = this.messageQueue.splice(0, 10); // Process up to 10 per round

    for (const message of messages) {
      for (const neighborId of neighbors) {
        this.sendToNeighbor(neighborId, message);
      }
    }

    this.node.lastSync = Date.now();
  }

  private selectRandomNeighbors(count: number): string[] {
    const neighbors = Array.from(this.node.neighbors);
    const selected: string[] = [];

    while (selected.length < count && neighbors.length > 0) {
      const idx = Math.floor(Math.random() * neighbors.length);
      selected.push(neighbors.splice(idx, 1)[0]!);
    }

    return selected;
  }

  private sendToNeighbor(neighborId: string, message: GossipMessage): void {
    const neighbor = this.nodes.get(neighborId);
    if (!neighbor) {
      return;
    }

    // Check if already seen
    if (neighbor.seenMessages.has(message.id)) {
      return;
    }

    // Deliver message to neighbor node
    const deliveredMessage: GossipMessage = {
      ...message,
      hops: message.hops + 1,
      path: [...message.path, neighborId],
    };

    // Process at neighbor
    this.processReceivedMessage(neighbor, deliveredMessage);
  }

  private processReceivedMessage(
    node: GossipNode,
    message: GossipMessage,
  ): void {
    // Mark as seen
    node.seenMessages.add(message.id);

    // Check TTL
    if (message.ttl <= 0 || message.hops >= this.config.maxHops) {
      return;
    }

    switch (message.type) {
      case "proposal":
        this.handleProposalMessage(node, message);
        break;
      case "vote":
        this.handleVoteMessage(message);
        break;
      case "state":
        this.handleStateMessage(node, message);
        break;
    }

    // Propagate to neighbors (gossip)
    if (message.hops < this.config.maxHops) {
      const propagateMessage: GossipMessage = {
        ...message,
        ttl: message.ttl - 1,
      };

      // Add to queue if this is our node
      if (node.id === this.node.id) {
        this.queueMessage(propagateMessage);
      }
    }
  }

  private handleProposalMessage(
    node: GossipNode,
    message: GossipMessage,
  ): void {
    const { proposalId, value } = message.payload as {
      proposalId: string;
      value: Record<string, unknown>;
    };

    if (!this.proposals.has(proposalId)) {
      const voteMap = new Map<string, ConsensusVote>();
      this.proposalVotes.set(proposalId, voteMap);

      const proposal: ConsensusProposal = {
        id: proposalId,
        proposerId: message.senderId,
        value,
        term: message.version,
        timestamp: message.timestamp,
        votes: [],
        status: "pending",
      };

      this.proposals.set(proposalId, proposal);

      // Auto-vote (simplified)
      if (node.id === this.node.id) {
        this.vote(proposalId, true, 0.9);
      }
    }
  }

  private handleVoteMessage(message: GossipMessage): void {
    const { proposalId, vote } = message.payload as {
      proposalId: string;
      vote: ConsensusVote;
    };

    const voteMap = this.proposalVotes.get(proposalId);
    if (voteMap && !voteMap.has(vote.voterId)) {
      voteMap.set(vote.voterId, vote);
      const proposal = this.proposals.get(proposalId);
      if (proposal) {
        proposal.votes = Array.from(voteMap.values());
      }
      this.checkConvergence(proposalId);
    }
  }

  private handleStateMessage(
    node: GossipNode,
    message: GossipMessage,
  ): void {
    const state = message.payload;

    // Merge state (last-writer-wins)
    if (message.version > node.version) {
      for (const [key, value] of Object.entries(state)) {
        node.state.set(key, value);
      }
      node.version = message.version;
    }
  }

  private queueMessage(message: GossipMessage): void {
    // Avoid duplicates
    if (!this.node.seenMessages.has(message.id)) {
      this.node.seenMessages.add(message.id);
      this.messageQueue.push(message);
    }
  }

  private checkConvergence(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== "pending") {
      return;
    }

    const voteMap = this.proposalVotes.get(proposalId);
    if (!voteMap) return;

    const totalNodes = this.nodes.size + 1;
    const votes = voteMap.size;

    // Check if we've converged (enough nodes have voted)
    if (votes / totalNodes >= this.config.convergenceThreshold) {
      const approvingVotes = Array.from(voteMap.values()).filter(
        (v) => v.approve,
      ).length;

      if (approvingVotes / votes >= this.config.threshold) {
        proposal.status = "accepted";
        proposal.votes = Array.from(voteMap.values());
        this.emitResolved(proposal);
      } else {
        proposal.status = "rejected";
        proposal.votes = Array.from(voteMap.values());
        this.emitResolved(proposal);
      }
    }
  }

  private emitResolved(proposal: ConsensusProposal): void {
    const voteMap = this.proposalVotes.get(proposal.id);
    const totalNodes = this.nodes.size + 1;
    const approvingVotes = voteMap
      ? Array.from(voteMap.values()).filter((v) => v.approve).length
      : 0;

    const result: ConsensusResult = {
      proposalId: proposal.id,
      approved: proposal.status === "accepted",
      approvalRate:
        voteMap && voteMap.size > 0 ? approvingVotes / voteMap.size : 0,
      participationRate: voteMap ? voteMap.size / totalNodes : 0,
      finalValue: proposal.value,
      rounds: this.node.version,
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
    const totalNodes = this.nodes.size + 1;
    const approvingVotes = voteMap
      ? Array.from(voteMap.values()).filter((v) => v.approve).length
      : 0;

    return {
      proposalId: proposal.id,
      approved: proposal.status === "accepted",
      approvalRate:
        voteMap && voteMap.size > 0 ? approvingVotes / voteMap.size : 0,
      participationRate: voteMap ? voteMap.size / totalNodes : 0,
      finalValue: proposal.value,
      rounds: this.node.version,
      durationMs,
      receipt: null,
    };
  }
}
