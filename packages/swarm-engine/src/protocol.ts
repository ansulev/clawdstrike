/**
 * Protocol bridge and topic utilities for the swarm engine.
 *
 * Maps engine events to SwarmEngineEnvelope on the correct channels,
 * builds topic strings for the /baychat/v1 protocol, and provides
 * parsing + routing utilities for the transport layer.
 *
 * @module
 */

import type {
  SwarmEngineEventMap,
  SwarmEngineEvent,
  SwarmEngineEnvelope,
} from "./events.js";
import { TypedEventEmitter } from "./events.js";

// ============================================================================
// Constants
// ============================================================================

/** Baychat protocol topic prefix. */
export const TOPIC_PREFIX = "/baychat/v1";

// ============================================================================
// Topic Builders (10 total: 4 existing + 6 new)
// ============================================================================

// -- Existing channel topics --

export function swarmIntelTopic(swarmId: string): string {
  return `${TOPIC_PREFIX}/swarm/${swarmId}/intel`;
}

export function swarmSignalTopic(swarmId: string): string {
  return `${TOPIC_PREFIX}/swarm/${swarmId}/signals`;
}

export function swarmDetectionTopic(swarmId: string): string {
  return `${TOPIC_PREFIX}/swarm/${swarmId}/detections`;
}

export function swarmCoordinationTopic(swarmId: string): string {
  return `${TOPIC_PREFIX}/swarm/${swarmId}/coordination`;
}

// -- New channel topics --

export function swarmAgentsTopic(swarmId: string): string {
  return `${TOPIC_PREFIX}/swarm/${swarmId}/agents`;
}

export function swarmTasksTopic(swarmId: string): string {
  return `${TOPIC_PREFIX}/swarm/${swarmId}/tasks`;
}

export function swarmTopologyTopic(swarmId: string): string {
  return `${TOPIC_PREFIX}/swarm/${swarmId}/topology`;
}

export function swarmConsensusTopic(swarmId: string): string {
  return `${TOPIC_PREFIX}/swarm/${swarmId}/consensus`;
}

export function swarmMemoryTopic(swarmId: string): string {
  return `${TOPIC_PREFIX}/swarm/${swarmId}/memory`;
}

export function swarmHooksTopic(swarmId: string): string {
  return `${TOPIC_PREFIX}/swarm/${swarmId}/hooks`;
}

// ============================================================================
// EVENT_TO_CHANNEL Map
// ============================================================================

/**
 * Maps SwarmEngineEventMap event kind strings to SwarmEngineEnvelope type values.
 * Used by ProtocolBridge to determine which channel an engine event belongs to.
 */
export const EVENT_TO_CHANNEL: Record<string, SwarmEngineEnvelope["type"]> = {
  "agent.spawned": "agent_lifecycle",
  "agent.terminated": "agent_lifecycle",
  "agent.status_changed": "agent_lifecycle",
  "agent.heartbeat": "agent_lifecycle",
  "task.created": "task_orchestration",
  "task.assigned": "task_orchestration",
  "task.status_changed": "task_orchestration",
  "task.completed": "task_orchestration",
  "task.failed": "task_orchestration",
  "task.progress": "task_orchestration",
  "topology.updated": "topology",
  "topology.rebalanced": "topology",
  "topology.leader_elected": "topology",
  "consensus.proposed": "consensus",
  "consensus.vote_cast": "consensus",
  "consensus.resolved": "consensus",
  "memory.store": "memory",
  "memory.search": "memory",
  "hooks.triggered": "hooks",
  "hooks.completed": "hooks",
  "guard.evaluated": "coordination",
  "action.denied": "coordination",
  "action.completed": "coordination",
};

// ============================================================================
// CHANNEL_TO_TOPIC_SUFFIX
// ============================================================================

/**
 * Maps envelope type to topic suffix for building topic strings.
 * Used by ProtocolBridge to construct the full topic for a given envelope type.
 */
export const CHANNEL_TO_TOPIC_SUFFIX: Record<SwarmEngineEnvelope["type"], string> = {
  intel: "intel",
  signal: "signals",
  detection: "detections",
  coordination: "coordination",
  status: "status",
  agent_lifecycle: "agents",
  task_orchestration: "tasks",
  topology: "topology",
  consensus: "consensus",
  memory: "memory",
  hooks: "hooks",
};

// ============================================================================
// ProtocolBridge
// ============================================================================

/**
 * Configuration for the ProtocolBridge.
 */
export interface ProtocolBridgeConfig {
  /** Swarm engine instance ID used in topic construction. */
  swarmId: string;
  /** Transport publish function. Called for every outgoing envelope. */
  publish: (topic: string, envelope: SwarmEngineEnvelope) => Promise<void>;
  /** Default TTL in Gossipsub hops. Defaults to 5. */
  defaultTtl?: number;
}

/**
 * Bridges the engine's internal TypedEventEmitter to the external transport
 * layer by subscribing to all mapped events, wrapping them in SwarmEngineEnvelope,
 * and publishing to the appropriate topic.
 *
 * Transport errors are swallowed -- the host is responsible for retry logic.
 */
export class ProtocolBridge {
  private readonly unsubscribers: Array<() => void> = [];
  private readonly defaultTtl: number;

  constructor(
    private readonly events: TypedEventEmitter<SwarmEngineEventMap>,
    private readonly config: ProtocolBridgeConfig,
  ) {
    this.defaultTtl = config.defaultTtl ?? 5;
  }

  /**
   * Subscribe to all mapped engine events and publish envelopes to transport.
   * Call disconnect() to remove all subscriptions.
   */
  connect(): void {
    for (const [eventKind, channel] of Object.entries(EVENT_TO_CHANNEL)) {
      const unsub = this.events.on(
        eventKind as keyof SwarmEngineEventMap,
        (data: unknown) => {
          const envelope: SwarmEngineEnvelope = {
            version: 1,
            type: channel,
            payload: data as SwarmEngineEvent,
            ttl: this.defaultTtl,
            created: Date.now(),
          };
          const topicSuffix = CHANNEL_TO_TOPIC_SUFFIX[channel];
          const topic = `${TOPIC_PREFIX}/swarm/${this.config.swarmId}/${topicSuffix}`;
          this.config.publish(topic, envelope).catch(() => {
            // Transport error -- swallow. Host handles retry.
          });
        },
      );
      this.unsubscribers.push(unsub);
    }
  }

  /**
   * Remove all event subscriptions. Safe to call multiple times.
   */
  disconnect(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  /**
   * Alias for disconnect(). Follows the Disposable convention.
   */
  dispose(): void {
    this.disconnect();
  }
}

// ============================================================================
// ExtendedSwarmChannel
// ============================================================================

/**
 * All valid swarm topic channel suffixes.
 * Superset: 4 existing ClawdStrike channels + 6 new orchestration channels.
 */
export type ExtendedSwarmChannel =
  | "intel" | "signals" | "detections" | "coordination"  // existing
  | "agents" | "tasks" | "topology" | "consensus"        // new
  | "memory" | "hooks";                                    // new

// ============================================================================
// ParsedSwarmTopic
// ============================================================================

/**
 * Result of parsing a swarm topic string.
 */
export interface ParsedSwarmTopic {
  swarmId: string;
  channel: ExtendedSwarmChannel;
}

// ============================================================================
// VALID_CHANNELS
// ============================================================================

/** O(1) lookup set for valid channel suffixes. */
const VALID_CHANNELS = new Set<ExtendedSwarmChannel>([
  "intel", "signals", "detections", "coordination",
  "agents", "tasks", "topology", "consensus", "memory", "hooks",
]);

// ============================================================================
// parseSwarmTopic
// ============================================================================

/**
 * Parse a topic string into its swarmId and channel components.
 *
 * Returns null for invalid topics or unrecognized channels.
 * Recognizes all 10 channels (4 existing + 6 new).
 */
export function parseSwarmTopic(topic: string): ParsedSwarmTopic | null {
  const prefix = `${TOPIC_PREFIX}/swarm/`;
  if (!topic.startsWith(prefix)) return null;
  const remainder = topic.slice(prefix.length);
  const slashIdx = remainder.indexOf("/");
  if (slashIdx === -1) return null;
  const swarmId = remainder.slice(0, slashIdx);
  const channel = remainder.slice(slashIdx + 1);
  if (!swarmId || !channel) return null;
  if (!VALID_CHANNELS.has(channel as ExtendedSwarmChannel)) return null;
  return { swarmId, channel: channel as ExtendedSwarmChannel };
}

// ============================================================================
// getSwarmTopics
// ============================================================================

/**
 * Options for getSwarmTopics.
 */
export interface GetSwarmTopicsOptions {
  includeSignals?: boolean;
  includeConsensus?: boolean;
  includeMemory?: boolean;
  includeHooks?: boolean;
}

/**
 * Build topic strings for subscribing to a swarm's channels.
 *
 * Default: 6 topics (intel, detections, coordination, agents, tasks, topology).
 * Optional: signals, consensus, memory, hooks (opt-in via options).
 *
 * Backward-compatible: accepts a boolean second argument (deprecated).
 * When a boolean is passed, a console.warn is emitted and it is treated as
 * `{ includeSignals: arg }`.
 */
export function getSwarmTopics(
  swarmId: string,
  optionsOrLegacyBoolean?: boolean | GetSwarmTopicsOptions,
): string[] {
  let options: GetSwarmTopicsOptions | undefined;
  if (typeof optionsOrLegacyBoolean === "boolean") {
    console.warn("[getSwarmTopics] boolean arg is deprecated, use options object");
    options = { includeSignals: optionsOrLegacyBoolean };
  } else {
    options = optionsOrLegacyBoolean;
  }
  const topics = [
    swarmIntelTopic(swarmId),
    swarmDetectionTopic(swarmId),
    swarmCoordinationTopic(swarmId),
    swarmAgentsTopic(swarmId),
    swarmTasksTopic(swarmId),
    swarmTopologyTopic(swarmId),
  ];
  if (options?.includeSignals) topics.push(swarmSignalTopic(swarmId));
  if (options?.includeConsensus) topics.push(swarmConsensusTopic(swarmId));
  if (options?.includeMemory) topics.push(swarmMemoryTopic(swarmId));
  if (options?.includeHooks) topics.push(swarmHooksTopic(swarmId));
  return topics;
}
