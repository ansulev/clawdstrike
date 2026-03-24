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
export { generateSwarmId } from "./ids.js";
export type { SwarmEngineIdPrefix } from "./ids.js";
