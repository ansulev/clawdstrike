/**
 * Consensus Engine Factory
 *
 * Unified interface for different consensus algorithms (Raft, Byzantine, Gossip).
 * Ported from ruflo v3 with TypedEventEmitter injection (no Node.js EventEmitter).
 *
 * Key changes from ruflo:
 * - No extends EventEmitter, constructor-injected TypedEventEmitter
 * - Paxos throws instead of silently falling back to Raft
 * - Delegates propose/vote/getActiveProposals/dispose to implementation
 *
 * @module
 */

import type { TypedEventEmitter, SwarmEngineEventMap } from "../events.js";
import type {
  ConsensusConfig,
  ConsensusProposal,
  ConsensusResult,
} from "../types.js";
import { SWARM_ENGINE_CONSTANTS } from "../types.js";
import { RaftConsensus } from "./raft.js";
import type { RaftConfig } from "./raft.js";
import { ByzantineConsensus } from "./byzantine.js";
import type { ByzantineConfig } from "./byzantine.js";
import { GossipConsensus } from "./gossip.js";
import type { GossipConfig } from "./gossip.js";

export { RaftConsensus, ByzantineConsensus, GossipConsensus };
export type { RaftConfig, ByzantineConfig, GossipConfig };

// ============================================================================
// ConsensusEngine Factory
// ============================================================================

type ConsensusImplementation =
  | RaftConsensus
  | ByzantineConsensus
  | GossipConsensus;

export class ConsensusEngine {
  private readonly events: TypedEventEmitter<SwarmEngineEventMap>;
  private readonly nodeId: string;
  private config: ConsensusConfig;
  private implementation: ConsensusImplementation | null = null;

  constructor(
    events: TypedEventEmitter<SwarmEngineEventMap>,
    nodeId: string,
    config?: Partial<ConsensusConfig>,
  ) {
    this.events = events;
    this.nodeId = nodeId;
    this.config = {
      algorithm: config?.algorithm ?? "raft",
      threshold:
        config?.threshold ?? SWARM_ENGINE_CONSTANTS.DEFAULT_CONSENSUS_THRESHOLD,
      timeoutMs:
        config?.timeoutMs ??
        SWARM_ENGINE_CONSTANTS.DEFAULT_CONSENSUS_TIMEOUT_MS,
      maxRounds: config?.maxRounds ?? 10,
      requireQuorum: config?.requireQuorum ?? true,
    };
  }

  /**
   * Initialize the consensus engine, creating the underlying implementation
   * based on the configured algorithm.
   */
  initialize(config?: Partial<ConsensusConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    const baseConfig = {
      threshold: this.config.threshold,
      timeoutMs: this.config.timeoutMs,
      maxRounds: this.config.maxRounds,
      requireQuorum: this.config.requireQuorum,
    };

    switch (this.config.algorithm) {
      case "raft":
        this.implementation = new RaftConsensus(
          this.events,
          this.nodeId,
          baseConfig,
        );
        break;

      case "byzantine":
        this.implementation = new ByzantineConsensus(
          this.events,
          this.nodeId,
          baseConfig,
        );
        break;

      case "gossip":
        this.implementation = new GossipConsensus(
          this.events,
          this.nodeId,
          baseConfig,
        );
        break;

      case "paxos":
        throw new Error("Paxos algorithm is not yet implemented");

      default:
        throw new Error(
          `Unknown consensus algorithm: ${this.config.algorithm as string}`,
        );
    }

    this.implementation.initialize();
  }

  /**
   * Add a node to the consensus cluster.
   * Delegates to the underlying implementation.
   */
  addNode(nodeId: string, options?: { isPrimary?: boolean }): void {
    if (!this.implementation) {
      throw new Error("Consensus engine not initialized");
    }

    if (this.implementation instanceof RaftConsensus) {
      this.implementation.addPeer(nodeId);
    } else if (this.implementation instanceof ByzantineConsensus) {
      this.implementation.addNode(nodeId, options?.isPrimary);
    } else if (this.implementation instanceof GossipConsensus) {
      this.implementation.addNode(nodeId);
    }
  }

  /**
   * Remove a node from the consensus cluster.
   */
  removeNode(nodeId: string): void {
    if (!this.implementation) {
      return;
    }

    if (this.implementation instanceof RaftConsensus) {
      this.implementation.removePeer(nodeId);
    } else if (this.implementation instanceof ByzantineConsensus) {
      this.implementation.removeNode(nodeId);
    } else if (this.implementation instanceof GossipConsensus) {
      this.implementation.removeNode(nodeId);
    }
  }

  /**
   * Propose a value for consensus.
   * Delegates to the underlying implementation.
   */
  propose(value: Record<string, unknown>): ConsensusProposal {
    if (!this.implementation) {
      throw new Error("Consensus engine not initialized");
    }

    return this.implementation.propose(value);
  }

  /**
   * Cast a vote on a proposal.
   */
  vote(proposalId: string, approve: boolean, confidence?: number): void {
    if (!this.implementation) {
      throw new Error("Consensus engine not initialized");
    }

    this.implementation.vote(proposalId, approve, confidence);
  }

  /**
   * Await consensus resolution on a proposal.
   */
  awaitConsensus(proposalId: string): Promise<ConsensusResult> {
    if (!this.implementation) {
      throw new Error("Consensus engine not initialized");
    }

    return this.implementation.awaitConsensus(proposalId);
  }

  /**
   * Get all active (pending) proposals with votes serialized as arrays.
   */
  getActiveProposals(): Record<string, ConsensusProposal> {
    if (!this.implementation) {
      return {};
    }

    return this.implementation.getActiveProposals();
  }

  /**
   * Get the current consensus algorithm.
   */
  getAlgorithm(): ConsensusConfig["algorithm"] {
    return this.config.algorithm;
  }

  /**
   * Get a copy of the current configuration.
   */
  getConfig(): ConsensusConfig {
    return { ...this.config };
  }

  /**
   * Check if the current node is the leader/primary.
   * Only applicable to Raft (isLeader) and Byzantine (isPrimary).
   * Gossip has no leader concept -- returns false.
   */
  isLeader(): boolean {
    if (this.implementation instanceof RaftConsensus) {
      return this.implementation.isLeader();
    }
    if (this.implementation instanceof ByzantineConsensus) {
      return this.implementation.getIsPrimary();
    }
    return false;
  }

  /**
   * Dispose the consensus engine. Clears all timers.
   * Does NOT call events.dispose() (shared emitter, not owned).
   */
  dispose(): void {
    if (this.implementation) {
      this.implementation.dispose();
      this.implementation = null;
    }
  }
}
