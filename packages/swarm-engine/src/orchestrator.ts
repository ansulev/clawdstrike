/**
 * SwarmOrchestrator -- facade composing all subsystems under a single
 * lifecycle with guard pipeline integration.
 *
 * The orchestrator is the main entry point for the swarm engine. It wires
 * AgentRegistry, TaskGraph, TopologyManager, and AgentPool together with:
 * - Lifecycle management (init / shutdown / pause / resume / dispose)
 * - Guard pipeline evaluation via injected GuardEvaluator (fail-closed)
 * - State snapshots (getState) and live metrics (getMetrics)
 * - Background timers (heartbeat, metrics)
 *
 * Design:
 * - Constructor injection for events, registry, taskGraph, topology
 * - AgentPool is constructed internally from config.pool
 * - dispose() is the ONLY method that calls events.dispose()
 * - No Node.js imports -- all timers use setInterval/clearInterval
 *
 * @module
 */

import type { TypedEventEmitter, SwarmEngineEventMap } from "./events.js";
import type { AgentRegistry } from "./agent-registry.js";
import type { TaskGraph } from "./task-graph.js";
import type { TopologyManager } from "./topology.js";
import { AgentPool } from "./agent-pool.js";
import { generateSwarmId } from "./ids.js";
import type {
  AgentSession,
  AgentSessionStatus,
  AgentPoolConfig,
  ConsensusConfig,
  EnvelopeReceipt,
  GuardedAction,
  GuardedActionRecord,
  GuardEvaluationResult,
  GuardEvaluator,
  Receipt,
  SwarmEngineMetrics,
  SwarmEngineState,
  SwarmEngineStatus,
  TopologyConfig,
} from "./types.js";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the SwarmOrchestrator.
 */
export interface SwarmOrchestratorConfig {
  /** Swarm namespace for ID scoping. */
  namespace: string;
  /** Topology config for the topology manager. */
  topology: TopologyConfig;
  /** Consensus config (placeholder for Phase 4). */
  consensus: ConsensusConfig;
  /** Agent pool config. */
  pool: Partial<AgentPoolConfig>;
  /** Max agents. */
  maxAgents: number;
  /** Max tasks. */
  maxTasks: number;
  /** Heartbeat interval in ms. Default: SWARM_ENGINE_CONSTANTS.DEFAULT_HEARTBEAT_INTERVAL_MS */
  heartbeatIntervalMs: number;
  /** Health check interval in ms. Default: SWARM_ENGINE_CONSTANTS.DEFAULT_HEALTH_CHECK_INTERVAL_MS */
  healthCheckIntervalMs: number;
  /** Task timeout in ms. Default: SWARM_ENGINE_CONSTANTS.DEFAULT_TASK_TIMEOUT_MS */
  taskTimeoutMs: number;
  /** Guard evaluator injected by host. If absent, all guarded actions are denied (fail-closed). */
  guardEvaluator?: GuardEvaluator;
  /** Max guard action records retained. Default: SWARM_ENGINE_CONSTANTS.MAX_GUARD_ACTION_HISTORY */
  maxGuardActionHistory: number;
}

// ============================================================================
// SwarmOrchestrator
// ============================================================================

/**
 * Facade composing all swarm engine subsystems.
 *
 * **Security invariant:** Subsystem references (registry, taskGraph, topology,
 * pool) MUST only be accessed through orchestrator methods so that all
 * mutations pass through the guard pipeline. Direct access to the subsystems
 * bypasses guard enforcement and violates the fail-closed contract.
 *
 * Usage:
 * ```ts
 * const events = new TypedEventEmitter<SwarmEngineEventMap>();
 * const registry = new AgentRegistry(events);
 * const taskGraph = new TaskGraph(events, registry);
 * const topology = new TopologyManager(events);
 * const orchestrator = new SwarmOrchestrator(events, registry, taskGraph, topology, config);
 * orchestrator.initialize();
 * ```
 */
export class SwarmOrchestrator {
  private readonly pool: AgentPool;
  private readonly mirroredPoolAgents = new Map<string, AgentSession>();
  private status: SwarmEngineStatus = "initializing";
  private startedAt: number | null = null;
  private readonly createdAt: number = Date.now();
  private readonly id: string;
  private readonly recentGuardActions: GuardedActionRecord[] = [];
  private guardEvaluationsTotal = 0;
  private guardDenialsTotal = 0;

  // Background timers
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly events: TypedEventEmitter<SwarmEngineEventMap>,
    private readonly registry: AgentRegistry,
    private readonly taskGraph: TaskGraph,
    private readonly topology: TopologyManager,
    private readonly config: SwarmOrchestratorConfig,
  ) {
    this.id = generateSwarmId("swe");
    this.pool = new AgentPool(events, config.pool);
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /**
   * Initialize the orchestrator. Sets status to "running", creates pool
   * agents, starts health checks, and begins background timers.
   *
   * Must be called from "initializing" or "stopped" status.
   */
  initialize(): void {
    if (this.status !== "initializing" && this.status !== "stopped") {
      throw new Error(
        `Cannot initialize from status "${this.status}". Expected "initializing" or "stopped".`,
      );
    }

    // Initialize pool first (creates minSize agents)
    this.pool.initialize();
    this.syncPoolAgents({ emitLifecycleEvents: true });

    // Start registry health checks
    this.registry.startHealthChecks();

    // Start background processes
    this.startBackgroundProcesses();

    // Update status
    this.startedAt = Date.now();
    this.status = "running";
  }

  /**
   * Shut down the orchestrator gracefully. Sets status to "stopped",
   * stops all background timers, and cleans up subsystems.
   *
   * Idempotent: calling from "stopped" is a no-op.
   */
  shutdown(): void {
    if (this.status === "stopped") {
      return;
    }

    this.status = "shutting_down";

    // Stop background timers
    this.stopBackgroundProcesses();

    // Shut down pool (clears agents, stops its health checks)
    this.pool.shutdown();
    this.syncPoolAgents({ emitLifecycleEvents: true });

    // Stop registry health checks
    this.registry.stopHealthChecks();

    this.status = "stopped";
  }

  /**
   * Pause the orchestrator. Stops background timers but retains state.
   *
   * No-op if not in "running" status.
   */
  pause(): void {
    if (this.status !== "running") {
      return;
    }

    this.stopBackgroundProcesses();
    this.status = "paused";
  }

  /**
   * Resume the orchestrator from "paused" status. Restarts background timers.
   *
   * No-op if not in "paused" status.
   */
  resume(): void {
    if (this.status !== "paused") {
      return;
    }

    this.startBackgroundProcesses();
    this.status = "running";
  }

  /**
   * Synchronous disposal. Stops all timers, disposes the pool, and disposes
   * the shared event emitter.
   *
   * This is the ONLY method that calls events.dispose().
   */
  dispose(): void {
    // Stop all timers (safe with null)
    this.stopBackgroundProcesses();

    // Dispose pool (stops its health check timer)
    this.pool.dispose();
    this.mirroredPoolAgents.clear();

    // Stop registry health checks so dispose actually releases all timers.
    this.registry.stopHealthChecks();

    // Dispose the shared emitter -- ONLY here
    this.events.dispose();

    this.status = "stopped";
  }

  // =========================================================================
  // Guard Pipeline
  // =========================================================================

  /**
   * Evaluate a guarded action through the guard pipeline.
   *
   * If no GuardEvaluator was injected, returns a deny result (fail-closed).
   * Emits "guard.evaluated" on every evaluation, "action.denied" on deny,
   * and "action.completed" on allow/warn.
   */
  async evaluateGuard(action: GuardedAction): Promise<GuardEvaluationResult> {
    const startMs = Date.now();
    let result: GuardEvaluationResult;

    if (!this.config.guardEvaluator) {
      // Fail-closed: no evaluator means deny all guarded actions
      result = {
        verdict: "deny",
        allowed: false,
        guardResults: [],
        receipt: this.createDenyReceipt(action),
        durationMs: 0,
        evaluatedAt: startMs,
      };
    } else {
      result = await this.config.guardEvaluator.evaluate(action);
    }

    const durationMs = Date.now() - startMs;

    // Track metrics
    this.guardEvaluationsTotal++;
    if (result.verdict === "deny") {
      this.guardDenialsTotal++;
    }

    // Store in audit log (FIFO eviction)
    const record: GuardedActionRecord = {
      action,
      evaluation: result,
      executed: result.allowed,
      executionError: null,
    };
    this.recentGuardActions.push(record);
    if (this.recentGuardActions.length > this.config.maxGuardActionHistory) {
      this.recentGuardActions.shift();
    }

    // Emit guard.evaluated event
    this.events.emit("guard.evaluated", {
      kind: "guard.evaluated",
      sourceAgentId: action.agentId,
      timestamp: Date.now(),
      action,
      result,
      durationMs,
    });

    if (result.verdict === "deny") {
      // Redact context to prevent sensitive data leaking via broadcast
      const redactedAction: GuardedAction = { ...action, context: {} };
      this.events.emit("action.denied", {
        kind: "action.denied",
        sourceAgentId: action.agentId,
        timestamp: Date.now(),
        action: redactedAction,
        receipt: this.envelopeReceiptFromReceipt(result.receipt),
        reason:
          result.guardResults.length > 0
            ? `Denied by guard: ${result.guardResults[0]?.guard ?? "unknown"}`
            : "no_evaluator",
      });
    } else {
      this.events.emit("action.completed", {
        kind: "action.completed",
        sourceAgentId: action.agentId,
        timestamp: Date.now(),
        action,
        receipt: this.envelopeReceiptFromReceipt(result.receipt),
        durationMs,
      });
    }

    return result;
  }

  // =========================================================================
  // State & Metrics
  // =========================================================================

  /**
   * Returns a complete snapshot of the swarm engine state.
   *
   * Aggregates state from all subsystems into a single serializable object.
   */
  getState(): SwarmEngineState {
    this.syncPoolAgents({ emitLifecycleEvents: false });
    const agents = this.getMergedAgentState();

    // Tasks from task graph
    const tasks = this.taskGraph.getState();

    return {
      id: this.id,
      namespace: this.config.namespace,
      version: "0.1.0",
      status: this.status,
      topologyConfig: this.config.topology,
      topology: this.topology.getState(),
      consensusConfig: this.config.consensus,
      agents,
      tasks,
      activeProposals: {}, // Phase 4
      metrics: this.getMetrics(),
      recentGuardActions: [...this.recentGuardActions],
      maxGuardActionHistory: this.config.maxGuardActionHistory,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      updatedAt: Date.now(),
    };
  }

  /**
   * Returns live swarm engine metrics.
   *
   * Computed on-demand from subsystem state. Not cached.
   */
  getMetrics(): SwarmEngineMetrics {
    this.syncPoolAgents({ emitLifecycleEvents: false });
    const now = Date.now();
    const agentSessions = Object.values(this.getMergedAgentState());
    const allTasks = Object.values(this.taskGraph.getState());
    const activeSessions = agentSessions.filter(
      (s) => s.status !== "terminated" && s.status !== "offline",
    );
    const completedTasks = allTasks.filter((t) => t.status === "completed");
    const failedTasks = allTasks.filter((t) => t.status === "failed");
    const avgDuration =
      completedTasks.length > 0
        ? completedTasks.reduce(
            (sum, t) =>
              sum + ((t.completedAt ?? now) - (t.startedAt ?? now)),
            0,
          ) / completedTasks.length
        : 0;

    return {
      uptimeMs: this.startedAt ? now - this.startedAt : 0,
      activeAgents: activeSessions.length,
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      avgTaskDurationMs: avgDuration,
      messagesPerSecond: 0, // Populated by protocol bridge in Phase 5
      consensusSuccessRate: 0, // Populated in Phase 4
      coordinationLatencyMs: 0,
      memoryUsageBytes: 0, // Populated in Phase 4
      guardEvaluationsTotal: this.guardEvaluationsTotal,
      guardDenialRate:
        this.guardEvaluationsTotal > 0
          ? this.guardDenialsTotal / this.guardEvaluationsTotal
          : 0,
    };
  }

  // =========================================================================
  // Convenience Accessors
  // =========================================================================

  /** Returns the internal agent pool. */
  getPool(): AgentPool {
    return this.pool;
  }

  /** Returns the current engine status. */
  getStatus(): SwarmEngineStatus {
    return this.status;
  }

  /** Returns the engine instance ID. */
  getId(): string {
    return this.id;
  }

  /** Returns the shared event emitter for external subscriptions. */
  getEvents(): TypedEventEmitter<SwarmEngineEventMap> {
    return this.events;
  }

  // =========================================================================
  // Private: Background Processes
  // =========================================================================

  /**
   * Start heartbeat background timer.
   * Metrics are computed lazily in getMetrics() -- no periodic timer needed.
   */
  private startBackgroundProcesses(): void {
    // Heartbeat timer: update pool agent heartbeats
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Stop all background timers. Safe to call with null timers.
   */
  private stopBackgroundProcesses(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Heartbeat tick: update pool agent heartbeats.
   */
  private performHeartbeat(): void {
    const poolState = this.pool.getState();
    for (const agentId of Object.keys(poolState.agents)) {
      this.pool.updateAgentHeartbeat(agentId);
    }
    this.syncPoolAgents({ emitLifecycleEvents: true, emitHeartbeats: true });
  }

  private getMergedAgentState(): Record<string, AgentSession> {
    return {
      ...Object.fromEntries(this.mirroredPoolAgents),
      ...this.registry.getState(),
    };
  }

  private syncPoolAgents(options: {
    emitLifecycleEvents: boolean;
    emitHeartbeats?: boolean;
  }): void {
    const poolAgents = this.pool.getState().agents;
    const registryState = this.registry.getState();
    const registryAgentIds = new Set(Object.keys(registryState));
    const seenPoolAgentIds = new Set<string>();

    for (const [agentId, pooled] of Object.entries(poolAgents)) {
      seenPoolAgentIds.add(agentId);

      if (registryAgentIds.has(agentId)) {
        this.mirroredPoolAgents.delete(agentId);
        continue;
      }

      const nextStatus = this.mapPooledStatusToSessionStatus(pooled.status);
      const now = Date.now();
      const existing = this.mirroredPoolAgents.get(agentId);

      if (!existing) {
        const created = this.createMirroredPoolAgent(
          agentId,
          pooled,
          nextStatus,
          now,
        );
        this.mirroredPoolAgents.set(agentId, created);

        if (options.emitLifecycleEvents) {
          this.events.emit("agent.spawned", {
            kind: "agent.spawned",
            agent: created,
            receipt: null,
            sourceAgentId: null,
            timestamp: now,
          });
        }

        if (options.emitHeartbeats) {
          this.events.emit("agent.heartbeat", {
            kind: "agent.heartbeat",
            agentId,
            health: created.health,
            workload: created.workload,
            metricsSnapshot: created.metrics,
            sourceAgentId: null,
            timestamp: now,
          });
        }

        continue;
      }

      const updated: AgentSession = {
        ...existing,
        status: nextStatus,
        workload: pooled.status === "busy" ? 1 : 0,
        health: pooled.health,
        lastHeartbeatAt: now,
        metrics: {
          ...existing.metrics,
          health: pooled.health,
          lastActivityAt: now,
        },
        updatedAt: now,
      };
      this.mirroredPoolAgents.set(agentId, updated);

      if (options.emitLifecycleEvents && existing.status !== nextStatus) {
        this.events.emit("agent.status_changed", {
          kind: "agent.status_changed",
          agentId,
          previousStatus: existing.status,
          newStatus: nextStatus,
          reason: "pool_sync",
          sourceAgentId: null,
          timestamp: now,
        });
      }

      if (options.emitHeartbeats) {
        this.events.emit("agent.heartbeat", {
          kind: "agent.heartbeat",
          agentId,
          health: updated.health,
          workload: updated.workload,
          metricsSnapshot: updated.metrics,
          sourceAgentId: null,
          timestamp: now,
        });
      }
    }

    for (const [agentId, mirrored] of Array.from(
      this.mirroredPoolAgents.entries(),
    )) {
      if (seenPoolAgentIds.has(agentId) || registryAgentIds.has(agentId)) {
        continue;
      }

      this.mirroredPoolAgents.delete(agentId);

      if (options.emitLifecycleEvents) {
        this.events.emit("agent.terminated", {
          kind: "agent.terminated",
          agentId,
          exitCode: null,
          reason: "pool_removed",
          finalMetrics: mirrored.metrics,
          sourceAgentId: null,
          timestamp: Date.now(),
        });
      }
    }
  }

  private mapPooledStatusToSessionStatus(
    pooledStatus: "available" | "busy" | "unhealthy",
  ): AgentSessionStatus {
    switch (pooledStatus) {
      case "available":
        return "idle";
      case "busy":
        return "running";
      case "unhealthy":
        return "offline";
    }
  }

  private createMirroredPoolAgent(
    agentId: string,
    pooled: {
      agentId: string;
      status: "available" | "busy" | "unhealthy";
      usageCount: number;
      health: number;
    },
    status: AgentSessionStatus,
    now: number,
  ): AgentSession {
    return {
      id: agentId,
      name: `Pool Agent ${agentId}`,
      role: "worker",
      status,
      capabilities: {
        codeGeneration: false,
        codeReview: false,
        testing: false,
        documentation: false,
        research: false,
        analysis: false,
        coordination: false,
        securityAnalysis: false,
        languages: [],
        frameworks: [],
        domains: [],
        tools: [],
        maxConcurrentTasks: 1,
        maxMemoryUsageBytes: 0,
        maxExecutionTimeMs: 0,
      },
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageExecutionTimeMs: 0,
        successRate: 0,
        cpuUsage: 0,
        memoryUsageBytes: 0,
        messagesProcessed: 0,
        lastActivityAt: now,
        responseTimeMs: 0,
        health: pooled.health,
      },
      quality: {
        reliability: 0.5,
        speed: 0.5,
        quality: 0.5,
      },
      currentTaskId: null,
      workload: pooled.status === "busy" ? 1 : 0,
      health: pooled.health,
      lastHeartbeatAt: now,
      topologyRole: null,
      connections: [],
      worktreePath: null,
      branch: null,
      risk: "low",
      policyMode: null,
      agentModel: "pooled",
      receiptCount: 0,
      blockedActionCount: 0,
      changedFilesCount: 0,
      filesTouched: [],
      toolBoundaryEvents: pooled.usageCount,
      confidence: null,
      guardResults: [],
      receipt: null,
      sentinelId: null,
      createdAt: now,
      updatedAt: now,
      exitCode: null,
    };
  }

  // =========================================================================
  // Private: Guard Helpers
  // =========================================================================

  /**
   * Create a minimal deny receipt for fail-closed evaluation.
   */
  private createDenyReceipt(action: GuardedAction): Receipt {
    return {
      id: generateSwarmId("rct" as import("./ids.js").SwarmEngineIdPrefix),
      timestamp: new Date().toISOString(),
      verdict: "deny",
      guard: "fail-closed",
      policyName: "no-evaluator",
      action: { type: action.actionType, target: action.target },
      evidence: {},
      signature: "",
      publicKey: "",
      valid: false,
    };
  }

  /**
   * Project a full Receipt to a compact EnvelopeReceipt for transport.
   */
  private envelopeReceiptFromReceipt(receipt: Receipt): EnvelopeReceipt {
    return {
      receiptId: receipt.id,
      verdict: receipt.verdict,
      decidingGuard: receipt.guard,
      policyHash: "",
      evaluationMs: 0,
      signature: receipt.signature,
      publicKey: receipt.publicKey,
      evaluatedAt: Date.now(),
    };
  }
}
