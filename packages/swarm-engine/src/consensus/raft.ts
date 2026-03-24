/**
 * Raft Consensus Implementation
 *
 * Leader election and log replication for distributed coordination.
 * Ported from ruflo v3 with TypedEventEmitter injection (no Node.js EventEmitter).
 *
 * Transforms applied:
 * - EventEmitter removed, TypedEventEmitter<SwarmEngineEventMap> injected via constructor
 * - NodeJS.Timeout -> ReturnType<typeof setTimeout> | null
 * - Date objects -> number (Unix ms via Date.now())
 * - proposal.votes: Map internal, ConsensusVote[] on public boundary
 * - generateSwarmId("csn") for proposal IDs
 * - Typed event emission (consensus.proposed, consensus.vote_cast, consensus.resolved, topology.leader_elected)
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

export type RaftState = "follower" | "candidate" | "leader";

export interface RaftNode {
  id: string;
  state: RaftState;
  currentTerm: number;
  votedFor?: string;
  log: RaftLogEntry[];
  commitIndex: number;
  lastApplied: number;
}

export interface RaftLogEntry {
  term: number;
  index: number;
  command: Record<string, unknown>;
  timestamp: number;
}

export interface RaftConfig {
  threshold?: number;
  timeoutMs?: number;
  maxRounds?: number;
  requireQuorum?: boolean;
  electionTimeoutMinMs?: number;
  electionTimeoutMaxMs?: number;
  heartbeatIntervalMs?: number;
}

// ============================================================================
// RaftConsensus
// ============================================================================

export class RaftConsensus {
  private readonly events: TypedEventEmitter<SwarmEngineEventMap>;
  private readonly config: Required<RaftConfig>;
  private readonly node: RaftNode;
  private readonly peers: Map<string, RaftNode> = new Map();
  /** Internal vote tracking: Map for O(1) dedup. Serialized to ConsensusVote[] on public boundary. */
  private readonly proposalVotes: Map<string, Map<string, ConsensusVote>> =
    new Map();
  private readonly proposals: Map<string, ConsensusProposal> = new Map();
  private electionTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    events: TypedEventEmitter<SwarmEngineEventMap>,
    nodeId: string,
    config?: RaftConfig,
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
      electionTimeoutMinMs: config?.electionTimeoutMinMs ?? 150,
      electionTimeoutMaxMs: config?.electionTimeoutMaxMs ?? 300,
      heartbeatIntervalMs: config?.heartbeatIntervalMs ?? 50,
    };

    this.node = {
      id: nodeId,
      state: "follower",
      currentTerm: 0,
      log: [],
      commitIndex: 0,
      lastApplied: 0,
    };
  }

  // ===== PUBLIC API =====

  initialize(): void {
    this.resetElectionTimeout();
  }

  addPeer(peerId: string): void {
    this.peers.set(peerId, {
      id: peerId,
      state: "follower",
      currentTerm: 0,
      log: [],
      commitIndex: 0,
      lastApplied: 0,
    });
  }

  removePeer(peerId: string): void {
    this.peers.delete(peerId);
  }

  propose(value: Record<string, unknown>): ConsensusProposal {
    if (this.node.state !== "leader") {
      throw new Error("Only leader can propose values");
    }

    const proposalId = generateSwarmId("csn");

    // Internal vote map for O(1) dedup
    const voteMap = new Map<string, ConsensusVote>();
    this.proposalVotes.set(proposalId, voteMap);

    const proposal: ConsensusProposal = {
      id: proposalId,
      proposerId: this.node.id,
      value,
      term: this.node.currentTerm,
      timestamp: Date.now(),
      votes: [],
      status: "pending",
    };

    // Add to local log
    const logEntry: RaftLogEntry = {
      term: this.node.currentTerm,
      index: this.node.log.length + 1,
      command: { proposalId, value },
      timestamp: Date.now(),
    };
    this.node.log.push(logEntry);

    this.proposals.set(proposalId, proposal);

    // Leader votes for itself
    const selfVote: ConsensusVote = {
      voterId: this.node.id,
      approve: true,
      confidence: 1.0,
      timestamp: Date.now(),
    };
    voteMap.set(this.node.id, selfVote);
    proposal.votes = Array.from(voteMap.values());

    // Replicate to followers
    this.replicateToFollowers(logEntry);

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
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== "pending") {
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

    // Check if we have consensus
    this.checkConsensus(proposalId);
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

  getState(): RaftState {
    return this.node.state;
  }

  getTerm(): number {
    return this.node.currentTerm;
  }

  isLeader(): boolean {
    return this.node.state === "leader";
  }

  getLeaderId(): string | undefined {
    if (this.node.state === "leader") {
      return this.node.id;
    }
    return this.node.votedFor;
  }

  getActiveProposals(): Record<string, ConsensusProposal> {
    const result: Record<string, ConsensusProposal> = {};
    for (const [id, proposal] of this.proposals) {
      if (proposal.status === "pending") {
        // Serialize votes from internal Map to array
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
    if (this.electionTimeout !== null) {
      clearTimeout(this.electionTimeout);
      this.electionTimeout = null;
    }
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Handle vote request from another candidate
  handleVoteRequest(
    candidateId: string,
    term: number,
    lastLogIndex: number,
    lastLogTerm: number,
  ): boolean {
    if (term < this.node.currentTerm) {
      return false;
    }

    if (term > this.node.currentTerm) {
      this.node.currentTerm = term;
      this.node.state = "follower";
      this.node.votedFor = undefined;
    }

    if (
      this.node.votedFor === undefined ||
      this.node.votedFor === candidateId
    ) {
      // Check log is at least as up-to-date
      const lastEntry = this.node.log[this.node.log.length - 1];
      const myLastTerm = lastEntry?.term ?? 0;
      const myLastIndex = lastEntry?.index ?? 0;

      if (
        lastLogTerm > myLastTerm ||
        (lastLogTerm === myLastTerm && lastLogIndex >= myLastIndex)
      ) {
        this.node.votedFor = candidateId;
        this.resetElectionTimeout();
        return true;
      }
    }

    return false;
  }

  // Handle append entries from leader
  handleAppendEntries(
    leaderId: string,
    term: number,
    entries: RaftLogEntry[],
    leaderCommit: number,
  ): boolean {
    if (term < this.node.currentTerm) {
      return false;
    }

    this.resetElectionTimeout();

    if (term > this.node.currentTerm) {
      this.node.currentTerm = term;
      this.node.state = "follower";
    }

    this.node.votedFor = leaderId;

    // Append entries
    this.node.log.push(...entries);

    // Update commit index
    if (leaderCommit > this.node.commitIndex) {
      this.node.commitIndex = Math.min(leaderCommit, this.node.log.length);
    }

    return true;
  }

  // ===== PRIVATE METHODS =====

  private resetElectionTimeout(): void {
    if (this.electionTimeout !== null) {
      clearTimeout(this.electionTimeout);
    }

    const timeout = this.randomElectionTimeout();
    this.electionTimeout = setTimeout(() => {
      this.startElection();
    }, timeout);
  }

  private randomElectionTimeout(): number {
    const min = this.config.electionTimeoutMinMs;
    const max = this.config.electionTimeoutMaxMs;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private startElection(): void {
    this.node.state = "candidate";
    this.node.currentTerm++;
    this.node.votedFor = this.node.id;

    const electionStart = Date.now();

    // Vote for self
    let votesReceived = 1;
    const votesNeeded = Math.floor((this.peers.size + 1) / 2) + 1;

    // Request votes from peers
    for (const [peerId] of this.peers) {
      const granted = this.requestVote(peerId);
      if (granted) {
        votesReceived++;
      }

      if (votesReceived >= votesNeeded) {
        this.becomeLeader(Date.now() - electionStart);
        return;
      }
    }

    // Election failed, reset to follower
    this.node.state = "follower";
    this.resetElectionTimeout();
  }

  private requestVote(peerId: string): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    // Local vote request - uses in-process peer state
    // Grant vote if candidate's term is higher
    if (this.node.currentTerm > peer.currentTerm) {
      peer.votedFor = this.node.id;
      peer.currentTerm = this.node.currentTerm;
      return true;
    }

    return false;
  }

  private becomeLeader(electionDurationMs: number): void {
    this.node.state = "leader";

    if (this.electionTimeout !== null) {
      clearTimeout(this.electionTimeout);
      this.electionTimeout = null;
    }

    // Start sending heartbeats
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
    }, this.config.heartbeatIntervalMs);

    this.events.emit("topology.leader_elected", {
      kind: "topology.leader_elected",
      sourceAgentId: this.node.id,
      timestamp: Date.now(),
      leaderId: this.node.id,
      term: this.node.currentTerm,
      electionDurationMs,
    });
  }

  private sendHeartbeats(): void {
    for (const [peerId] of this.peers) {
      this.appendEntries(peerId, []);
    }
  }

  private appendEntries(peerId: string, entries: RaftLogEntry[]): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    // AppendEntries - local peer state update
    if (this.node.currentTerm >= peer.currentTerm) {
      peer.currentTerm = this.node.currentTerm;
      peer.state = "follower";
      peer.log.push(...entries);
      return true;
    }

    return false;
  }

  private replicateToFollowers(entry: RaftLogEntry): void {
    let successCount = 0;
    for (const [peerId] of this.peers) {
      if (this.appendEntries(peerId, [entry])) {
        successCount++;
      }
    }

    // Check if majority replicated
    const majority = Math.floor((this.peers.size + 1) / 2) + 1;
    if (successCount + 1 >= majority) {
      this.node.commitIndex = entry.index;
    }
  }

  private checkConsensus(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== "pending") {
      return;
    }

    const voteMap = this.proposalVotes.get(proposalId);
    if (!voteMap) return;

    const totalVoters = this.peers.size + 1;
    const votesReceived = voteMap.size;
    const approvingVotes = Array.from(voteMap.values()).filter(
      (v) => v.approve,
    ).length;

    const quorum = Math.floor(totalVoters * this.config.threshold);

    if (approvingVotes >= quorum) {
      proposal.status = "accepted";
      proposal.votes = Array.from(voteMap.values());
      this.emitResolved(proposal);
    } else if (votesReceived - approvingVotes > totalVoters - quorum) {
      proposal.status = "rejected";
      proposal.votes = Array.from(voteMap.values());
      this.emitResolved(proposal);
    }
  }

  private emitResolved(proposal: ConsensusProposal): void {
    const voteMap = this.proposalVotes.get(proposal.id);
    const totalVoters = this.peers.size + 1;
    const approvingVotes = voteMap
      ? Array.from(voteMap.values()).filter((v) => v.approve).length
      : 0;

    const result: ConsensusResult = {
      proposalId: proposal.id,
      approved: proposal.status === "accepted",
      approvalRate:
        voteMap && voteMap.size > 0 ? approvingVotes / voteMap.size : 0,
      participationRate: voteMap ? voteMap.size / totalVoters : 0,
      finalValue: proposal.value,
      rounds: 1,
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
    const totalVoters = this.peers.size + 1;
    const approvingVotes = voteMap
      ? Array.from(voteMap.values()).filter((v) => v.approve).length
      : 0;

    return {
      proposalId: proposal.id,
      approved: proposal.status === "accepted",
      approvalRate:
        voteMap && voteMap.size > 0 ? approvingVotes / voteMap.size : 0,
      participationRate: voteMap ? voteMap.size / totalVoters : 0,
      finalValue: proposal.value,
      rounds: 1,
      durationMs,
      receipt: null,
    };
  }
}
