/**
 * @clawdstrike/swarm-engine
 *
 * Runtime security enforcement + AI agent orchestration unified type system.
 * Zero runtime dependencies. ESM-only.
 *
 * @packageDocumentation
 */

export * from "./types.js";
export * from "./events.js";
export { Deque, PriorityQueue } from "./collections.js";
export { TopologyManager } from "./topology.js";
export type { AdaptiveThresholds } from "./topology.js";
export { AgentRegistry } from "./agent-registry.js";
export type { AgentRegistryConfig } from "./agent-registry.js";
export { generateSwarmId } from "./ids.js";
export type { SwarmEngineIdPrefix } from "./ids.js";
