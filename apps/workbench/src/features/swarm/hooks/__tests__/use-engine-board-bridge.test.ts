import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { TypedEventEmitter } from "@clawdstrike/swarm-engine";
import type {
  SwarmEngineEventMap,
  SwarmEngineState,
} from "@clawdstrike/swarm-engine";
import { useEngineBoardBridge } from "../use-engine-board-bridge";
import { useSwarmBoardStore } from "@/features/swarm/stores/swarm-board-store";

function resetStore() {
  const { actions } = useSwarmBoardStore.getState();
  actions.clearBoard();
}

function makeEngineState(): SwarmEngineState {
  const now = Date.now();
  return {
    id: "swe_test",
    namespace: "workbench",
    version: "0.1.0",
    status: "running",
    topologyConfig: {
      type: "mesh",
      maxAgents: 5,
      replicationFactor: 1,
      partitionStrategy: "round-robin",
      failoverEnabled: true,
      autoRebalance: true,
    },
    topology: {
      type: "mesh",
      nodes: [
        {
          id: "agt_pool_1",
          agentId: "agt_pool_1",
          role: "worker",
          status: "active",
          connections: [],
          metadata: {},
          positionX: 240,
          positionY: 120,
          hierarchyDepth: null,
        },
      ],
      edges: [],
      leaderId: null,
      partitions: [],
      snapshotAt: now,
    },
    consensusConfig: {
      algorithm: "raft",
      threshold: 0.5,
      timeoutMs: 30_000,
      maxRounds: 3,
      requireQuorum: true,
    },
    agents: {
      agt_pool_1: {
        id: "agt_pool_1",
        name: "Pool Agent agt_pool_1",
        role: "worker",
        status: "idle",
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
          health: 1,
        },
        quality: {
          reliability: 0.5,
          speed: 0.5,
          quality: 0.5,
        },
        currentTaskId: null,
        workload: 0,
        health: 1,
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
        toolBoundaryEvents: 0,
        confidence: null,
        guardResults: [],
        receipt: null,
        sentinelId: null,
        createdAt: now,
        updatedAt: now,
        exitCode: null,
      },
    },
    tasks: {},
    activeProposals: {},
    metrics: {
      uptimeMs: 100,
      activeAgents: 1,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgTaskDurationMs: 0,
      messagesPerSecond: 0,
      consensusSuccessRate: 0,
      coordinationLatencyMs: 0,
      memoryUsageBytes: 0,
      guardEvaluationsTotal: 0,
      guardDenialRate: 0,
    },
    recentGuardActions: [],
    maxGuardActionHistory: 100,
    createdAt: now,
    startedAt: now,
    updatedAt: now,
  };
}

describe("useEngineBoardBridge", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("seeds engine-managed nodes from the initial orchestrator snapshot", () => {
    const events = new TypedEventEmitter<SwarmEngineEventMap>();
    const engine = {
      getState: () => makeEngineState(),
      getEvents: () => events,
    };

    const { unmount } = renderHook(() =>
      useEngineBoardBridge(engine as any),
    );

    const agentNode = useSwarmBoardStore
      .getState()
      .nodes.find((node) => node.data.agentId === "agt_pool_1");

    expect(agentNode).toBeDefined();
    expect(agentNode?.data.engineManaged).toBe(true);
    expect(agentNode?.position).toEqual({ x: 240, y: 120 });

    unmount();
  });
});
