/**
 * AgentRegistry -- agent lifecycle management for the swarm engine.
 *
 * Ported from ruflo v3 `coordination/agent-registry.ts` (544 lines) with
 * browser-safe adaptations:
 * - No Node.js imports (uses setInterval/clearInterval directly)
 * - Synchronous TypedEventEmitter (ruflo's was async)
 * - Full AgentSession creation with all 30+ fields
 * - Record-based state accessors (never Map)
 * - No hardcoded default agents
 *
 * @module
 */

import type { TypedEventEmitter, SwarmEngineEventMap } from "./events.js";
import { generateSwarmId } from "./ids.js";
import type {
  AgentCapabilities,
  AgentMetrics,
  AgentQualityScores,
  AgentRegistration,
  AgentSession,
  AgentSessionStatus,
  HealthCheckStatus,
  TaskType,
} from "./types.js";
import { SWARM_ENGINE_CONSTANTS } from "./types.js";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the AgentRegistry.
 */
export interface AgentRegistryConfig {
  /** Interval between health checks in milliseconds. */
  healthCheckIntervalMs?: number;
  /** Number of consecutive missed heartbeats before marking agent as failed. */
  maxMissedHeartbeats?: number;
}

// ============================================================================
// TaskType -> AgentCapabilities mapping
// ============================================================================

const TASK_TYPE_TO_CAPABILITY: Partial<Record<TaskType, keyof AgentCapabilities>> = {
  coding: "codeGeneration",
  review: "codeReview",
  testing: "testing",
  documentation: "documentation",
  research: "research",
  analysis: "analysis",
  coordination: "coordination",
  detection: "securityAnalysis",
  hunt: "securityAnalysis",
  consensus: "coordination",
  guard_evaluation: "securityAnalysis",
};

// ============================================================================
// AgentRegistry
// ============================================================================

/**
 * Agent lifecycle manager for the swarm engine.
 *
 * Manages agent registration, spawning, termination, health checks,
 * capability queries, and metrics tracking. All events are emitted
 * through the shared TypedEventEmitter.
 */
export class AgentRegistry {
  private readonly registrations = new Map<string, AgentRegistration>();
  private readonly sessions = new Map<string, AgentSession>();
  private readonly healthChecks = new Map<string, HealthCheckStatus>();
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  private readonly healthCheckIntervalMs: number;
  private readonly maxMissedHeartbeats: number;

  constructor(
    private readonly events: TypedEventEmitter<SwarmEngineEventMap>,
    config: AgentRegistryConfig = {},
  ) {
    this.healthCheckIntervalMs =
      config.healthCheckIntervalMs ??
      SWARM_ENGINE_CONSTANTS.DEFAULT_HEALTH_CHECK_INTERVAL_MS;
    this.maxMissedHeartbeats = config.maxMissedHeartbeats ?? 3;
  }

  // ==========================================================================
  // Registration
  // ==========================================================================

  /**
   * Register an agent definition. Returns the generated agent ID.
   *
   * @throws If name is empty.
   */
  register(registration: AgentRegistration): string {
    if (!registration.name) {
      throw new Error("Agent registration name must not be empty");
    }

    const id = generateSwarmId("agt");

    this.registrations.set(id, registration);

    this.healthChecks.set(id, {
      agentId: id,
      healthy: false,
      lastHeartbeatAt: 0,
      consecutiveMisses: 0,
      status: "idle",
    });

    return id;
  }

  /**
   * Unregister an agent. Returns true if the agent was registered, false otherwise.
   *
   * @throws If the agent has an active session.
   */
  unregister(agentId: string): boolean {
    if (this.sessions.has(agentId)) {
      throw new Error(
        `Cannot unregister active agent ${agentId}`,
      );
    }

    this.healthChecks.delete(agentId);
    return this.registrations.delete(agentId);
  }

  /**
   * Get a registration by agent ID, or undefined if not registered.
   */
  getRegistration(agentId: string): AgentRegistration | undefined {
    return this.registrations.get(agentId);
  }

  /**
   * Get all registrations as an array.
   */
  getAllRegistrations(): AgentRegistration[] {
    return Array.from(this.registrations.values());
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Spawn an agent from its registration, creating a full AgentSession.
   *
   * @throws If agent is not registered or already spawned.
   */
  spawn(agentId: string): AgentSession {
    const registration = this.registrations.get(agentId);
    if (!registration) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    if (this.sessions.has(agentId)) {
      throw new Error(`Agent ${agentId} is already spawned`);
    }

    const session = createDefaultAgentSession(agentId, registration);
    this.sessions.set(agentId, session);

    // Update health check status
    const healthStatus = this.healthChecks.get(agentId);
    if (healthStatus) {
      healthStatus.healthy = true;
      healthStatus.lastHeartbeatAt = session.lastHeartbeatAt;
      healthStatus.status = "idle";
    }

    this.events.emit("agent.spawned", {
      kind: "agent.spawned",
      agent: session,
      receipt: null,
      sourceAgentId: null,
      timestamp: Date.now(),
    });

    return session;
  }

  /**
   * Terminate an agent, removing its session.
   *
   * @returns true if the agent was terminated, false if it had no session.
   * @throws If the agent has an active task.
   */
  terminate(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session) {
      return false;
    }

    if (session.currentTaskId !== null) {
      throw new Error(
        `Cannot terminate agent ${agentId} with active task ${session.currentTaskId}`,
      );
    }

    this.sessions.delete(agentId);

    const healthStatus = this.healthChecks.get(agentId);
    if (healthStatus) {
      healthStatus.healthy = false;
      healthStatus.status = "idle";
    }

    this.events.emit("agent.terminated", {
      kind: "agent.terminated",
      agentId,
      exitCode: session.exitCode,
      reason: "terminated",
      finalMetrics: session.metrics,
      sourceAgentId: null,
      timestamp: Date.now(),
    });

    return true;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Update an agent's status and emit a status_changed event.
   *
   * @throws If the agent is not spawned.
   */
  updateStatus(
    agentId: string,
    status: AgentSessionStatus,
    reason?: string,
  ): void {
    const session = this.sessions.get(agentId);
    if (!session) {
      throw new Error(`Agent ${agentId} is not spawned`);
    }

    const previousStatus = session.status;
    session.status = status;
    session.updatedAt = Date.now();

    const healthStatus = this.healthChecks.get(agentId);
    if (healthStatus) {
      healthStatus.status = status;
    }

    this.events.emit("agent.status_changed", {
      kind: "agent.status_changed",
      agentId,
      previousStatus,
      newStatus: status,
      reason: reason ?? null,
      sourceAgentId: null,
      timestamp: Date.now(),
    });
  }

  /**
   * Assign a task to an agent. Sets currentTaskId and status to "running".
   *
   * @throws If the agent is not spawned or already has a task.
   */
  assignTask(agentId: string, taskId: string): void {
    const session = this.sessions.get(agentId);
    if (!session) {
      throw new Error(`Agent ${agentId} is not spawned`);
    }

    if (session.currentTaskId !== null) {
      throw new Error(
        `Agent ${agentId} already has task ${session.currentTaskId}`,
      );
    }

    session.currentTaskId = taskId;
    this.updateStatus(agentId, "running");
  }

  /**
   * Mark a task as completed. Updates metrics and clears currentTaskId.
   *
   * @throws If the agent is not spawned or taskId doesn't match.
   */
  completeTask(agentId: string, taskId: string, durationMs?: number): void {
    const session = this.sessions.get(agentId);
    if (!session) {
      throw new Error(`Agent ${agentId} is not spawned`);
    }

    if (session.currentTaskId !== taskId) {
      throw new Error(
        `Agent ${agentId} current task is ${session.currentTaskId}, not ${taskId}`,
      );
    }

    const metrics = session.metrics;
    metrics.tasksCompleted++;

    // Recalculate success rate
    const total = metrics.tasksCompleted + metrics.tasksFailed;
    metrics.successRate = total > 0 ? metrics.tasksCompleted / total : 0;

    // Update average execution time if duration provided
    if (durationMs !== undefined) {
      const prevTotal =
        metrics.averageExecutionTimeMs * (metrics.tasksCompleted - 1);
      metrics.averageExecutionTimeMs =
        (prevTotal + durationMs) / metrics.tasksCompleted;
    }

    // Update health based on success rate
    metrics.health = Math.max(
      0,
      Math.min(1, 0.5 + metrics.successRate * 0.5),
    );

    metrics.lastActivityAt = Date.now();

    session.currentTaskId = null;
    this.updateStatus(agentId, "idle");
  }

  /**
   * Mark a task as failed. Updates metrics and clears currentTaskId.
   *
   * @throws If the agent is not spawned or taskId doesn't match.
   */
  failTask(agentId: string, taskId: string): void {
    const session = this.sessions.get(agentId);
    if (!session) {
      throw new Error(`Agent ${agentId} is not spawned`);
    }

    if (session.currentTaskId !== taskId) {
      throw new Error(
        `Agent ${agentId} current task is ${session.currentTaskId}, not ${taskId}`,
      );
    }

    const metrics = session.metrics;
    metrics.tasksFailed++;

    // Recalculate success rate
    const total = metrics.tasksCompleted + metrics.tasksFailed;
    metrics.successRate = total > 0 ? metrics.tasksCompleted / total : 0;

    metrics.lastActivityAt = Date.now();

    session.currentTaskId = null;
    this.updateStatus(agentId, "idle");
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get a single agent session, or undefined if not spawned.
   */
  getAgentSession(agentId: string): AgentSession | undefined {
    return this.sessions.get(agentId);
  }

  /**
   * Get all agent sessions as a Record (not Map) for JSON serialization.
   */
  getState(): Record<string, AgentSession> {
    return Object.fromEntries(this.sessions);
  }

  /**
   * Get agents currently in "running" status.
   */
  getActiveAgents(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "running",
    );
  }

  /**
   * Get agents currently in "idle" status.
   */
  getIdleAgents(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "idle",
    );
  }

  /**
   * Get agents whose capabilities match the requested task type.
   *
   * Maps TaskType to AgentCapabilities boolean fields:
   * - coding -> codeGeneration
   * - review -> codeReview
   * - testing -> testing
   * - documentation -> documentation
   * - research -> research
   * - analysis -> analysis
   * - coordination -> coordination
   * - detection -> securityAnalysis
   * - hunt -> securityAnalysis
   *
   * For unmapped types (consensus, guard_evaluation, custom), checks
   * capabilities.tools array.
   */
  getAgentsByCapability(taskType: TaskType): AgentSession[] {
    const capKey = TASK_TYPE_TO_CAPABILITY[taskType];

    return Array.from(this.sessions.values()).filter((s) => {
      if (capKey) {
        return s.capabilities[capKey] === true;
      }
      // Unmapped types: check tools array
      return s.capabilities.tools.includes(taskType);
    });
  }

  /**
   * Get the number of active sessions.
   */
  getAgentCount(): number {
    return this.sessions.size;
  }

  // ==========================================================================
  // Health Management
  // ==========================================================================

  /**
   * Record a heartbeat from an agent.
   * Updates lastHeartbeatAt, resets consecutiveMisses, and emits
   * agent.heartbeat event.
   */
  heartbeat(agentId: string): void {
    const now = Date.now();

    const session = this.sessions.get(agentId);
    if (session) {
      session.lastHeartbeatAt = now;
    }

    const healthStatus = this.healthChecks.get(agentId);
    if (healthStatus) {
      healthStatus.lastHeartbeatAt = now;
      healthStatus.consecutiveMisses = 0;
      healthStatus.healthy = true;
    }

    if (session) {
      this.events.emit("agent.heartbeat", {
        kind: "agent.heartbeat",
        agentId,
        health: session.health,
        workload: session.workload,
        metricsSnapshot: session.metrics,
        sourceAgentId: null,
        timestamp: now,
      });
    }
  }

  /**
   * Start periodic health checks.
   * Idempotent -- calling twice does not create duplicate timers.
   */
  startHealthChecks(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(
      () => this.performHealthCheck(),
      this.healthCheckIntervalMs,
    );
  }

  /**
   * Stop periodic health checks.
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Get health status for all registered agents as a Record.
   */
  getHealthStatus(): Record<string, HealthCheckStatus> {
    return Object.fromEntries(this.healthChecks);
  }

  // ==========================================================================
  // Dispose
  // ==========================================================================

  /**
   * Clean up resources. Stops health checks.
   * Does NOT call events.dispose() -- the shared emitter is owned by
   * the orchestrator (per Research Pitfall 7).
   */
  dispose(): void {
    this.stopHealthChecks();
  }

  // ==========================================================================
  // Private
  // ==========================================================================

  private performHealthCheck(): void {
    const now = Date.now();

    for (const [agentId, healthStatus] of this.healthChecks) {
      const session = this.sessions.get(agentId);
      if (!session) {
        continue;
      }

      const timeSinceHeartbeat = now - healthStatus.lastHeartbeatAt;

      if (timeSinceHeartbeat > this.healthCheckIntervalMs) {
        healthStatus.consecutiveMisses++;

        if (healthStatus.consecutiveMisses >= this.maxMissedHeartbeats) {
          healthStatus.healthy = false;
          this.updateStatus(agentId, "failed");
        }
      }
    }
  }
}

// ============================================================================
// Factory helper
// ============================================================================

/**
 * Create a default AgentSession with all 30+ fields initialized to
 * sensible defaults from the registration data.
 */
function createDefaultAgentSession(
  id: string,
  registration: AgentRegistration,
): AgentSession {
  const now = Date.now();

  const quality: AgentQualityScores = {
    reliability: registration.quality?.reliability ?? 0.5,
    speed: registration.quality?.speed ?? 0.5,
    quality: registration.quality?.quality ?? 0.5,
  };

  const metrics: AgentMetrics = {
    tasksCompleted: 0,
    tasksFailed: 0,
    averageExecutionTimeMs: 0,
    successRate: 0,
    cpuUsage: 0,
    memoryUsageBytes: 0,
    messagesProcessed: 0,
    lastActivityAt: now,
    responseTimeMs: 0,
    health: 1.0,
  };

  return {
    id,
    name: registration.name,
    role: registration.role,
    status: "idle",

    // Orchestration
    capabilities: registration.capabilities,
    metrics,
    quality,
    currentTaskId: null,
    workload: 0,
    health: 1.0,
    lastHeartbeatAt: now,
    topologyRole: null,
    connections: [],

    // Board fields
    worktreePath: null,
    branch: null,
    risk: "low",
    policyMode: registration.policyMode ?? null,
    agentModel: registration.agentModel ?? null,
    receiptCount: 0,
    blockedActionCount: 0,
    changedFilesCount: 0,
    filesTouched: [],
    toolBoundaryEvents: 0,
    confidence: null,
    guardResults: [],

    // Guard integration
    receipt: null,

    // Sentinel bridge
    sentinelId: null,

    // Timestamps
    createdAt: now,
    updatedAt: now,
    exitCode: null,
  };
}
