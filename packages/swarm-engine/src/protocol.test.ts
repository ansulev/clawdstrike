import { describe, it, expect, vi } from "vitest";
import type { SwarmEngineEventMap, SwarmEngineEnvelope } from "./events.js";
import { TypedEventEmitter } from "./events.js";
import type { AgentSession, AgentMetrics } from "./types.js";

// Lazy import -- protocol.ts does not exist yet during RED phase.
// Tests will fail with "module not found" until GREEN phase.
import {
  TOPIC_PREFIX,
  swarmIntelTopic,
  swarmSignalTopic,
  swarmDetectionTopic,
  swarmCoordinationTopic,
  swarmAgentsTopic,
  swarmTasksTopic,
  swarmTopologyTopic,
  swarmConsensusTopic,
  swarmMemoryTopic,
  swarmHooksTopic,
  EVENT_TO_CHANNEL,
  CHANNEL_TO_TOPIC_SUFFIX,
  ProtocolBridge,
  type ProtocolBridgeConfig,
} from "./protocol.js";

// ============================================================================
// Test Fixtures
// ============================================================================

function makeAgentMetrics(): AgentMetrics {
  return {
    tasksCompleted: 0,
    tasksFailed: 0,
    averageExecutionTimeMs: 0,
    successRate: 1,
    cpuUsage: 0.1,
    memoryUsageBytes: 1024,
    messagesProcessed: 0,
    lastActivityAt: Date.now(),
    responseTimeMs: 50,
    health: 1,
  };
}

function makeAgentSession(overrides?: Partial<AgentSession>): AgentSession {
  return {
    id: "agt_01HXKTEST000000000000000",
    name: "test-agent",
    role: "worker",
    status: "idle",
    capabilities: {
      codeGeneration: true,
      codeReview: false,
      testing: false,
      documentation: false,
      research: false,
      analysis: false,
      coordination: false,
      securityAnalysis: false,
      languages: ["typescript"],
      frameworks: [],
      domains: [],
      tools: [],
      maxConcurrentTasks: 3,
      maxMemoryUsageBytes: 1_000_000,
      maxExecutionTimeMs: 300_000,
    },
    metrics: makeAgentMetrics(),
    quality: { reliability: 0.5, speed: 0.5, quality: 0.5 },
    currentTaskId: null,
    workload: 0,
    health: 1,
    lastHeartbeatAt: Date.now(),
    topologyRole: null,
    connections: [],
    worktreePath: null,
    branch: null,
    risk: "low",
    policyMode: null,
    agentModel: null,
    receiptCount: 0,
    blockedActionCount: 0,
    changedFilesCount: 0,
    filesTouched: [],
    toolBoundaryEvents: 0,
    confidence: null,
    guardResults: [],
    receipt: null,
    sentinelId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    exitCode: null,
    ...overrides,
  };
}

// ============================================================================
// Topic Builders
// ============================================================================

describe("Topic builders", () => {
  it("TOPIC_PREFIX is /baychat/v1", () => {
    expect(TOPIC_PREFIX).toBe("/baychat/v1");
  });

  it("swarmAgentsTopic produces correct topic", () => {
    expect(swarmAgentsTopic("swe_abc")).toBe("/baychat/v1/swarm/swe_abc/agents");
  });

  it("swarmTasksTopic produces correct topic", () => {
    expect(swarmTasksTopic("swe_abc")).toBe("/baychat/v1/swarm/swe_abc/tasks");
  });

  it("swarmTopologyTopic produces correct topic", () => {
    expect(swarmTopologyTopic("swe_abc")).toBe("/baychat/v1/swarm/swe_abc/topology");
  });

  it("swarmConsensusTopic produces correct topic", () => {
    expect(swarmConsensusTopic("swe_abc")).toBe("/baychat/v1/swarm/swe_abc/consensus");
  });

  it("swarmMemoryTopic produces correct topic", () => {
    expect(swarmMemoryTopic("swe_abc")).toBe("/baychat/v1/swarm/swe_abc/memory");
  });

  it("swarmHooksTopic produces correct topic", () => {
    expect(swarmHooksTopic("swe_abc")).toBe("/baychat/v1/swarm/swe_abc/hooks");
  });

  // Existing topics
  it("swarmIntelTopic produces correct topic", () => {
    expect(swarmIntelTopic("swe_abc")).toBe("/baychat/v1/swarm/swe_abc/intel");
  });

  it("swarmSignalTopic produces correct topic", () => {
    expect(swarmSignalTopic("swe_abc")).toBe("/baychat/v1/swarm/swe_abc/signals");
  });

  it("swarmDetectionTopic produces correct topic", () => {
    expect(swarmDetectionTopic("swe_abc")).toBe("/baychat/v1/swarm/swe_abc/detections");
  });

  it("swarmCoordinationTopic produces correct topic", () => {
    expect(swarmCoordinationTopic("swe_abc")).toBe("/baychat/v1/swarm/swe_abc/coordination");
  });
});

// ============================================================================
// EVENT_TO_CHANNEL Map
// ============================================================================

describe("EVENT_TO_CHANNEL", () => {
  it('maps "agent.spawned" to "agent_lifecycle"', () => {
    expect(EVENT_TO_CHANNEL["agent.spawned"]).toBe("agent_lifecycle");
  });

  it('maps "agent.terminated" to "agent_lifecycle"', () => {
    expect(EVENT_TO_CHANNEL["agent.terminated"]).toBe("agent_lifecycle");
  });

  it('maps "agent.status_changed" to "agent_lifecycle"', () => {
    expect(EVENT_TO_CHANNEL["agent.status_changed"]).toBe("agent_lifecycle");
  });

  it('maps "agent.heartbeat" to "agent_lifecycle"', () => {
    expect(EVENT_TO_CHANNEL["agent.heartbeat"]).toBe("agent_lifecycle");
  });

  it('maps "task.created" to "task_orchestration"', () => {
    expect(EVENT_TO_CHANNEL["task.created"]).toBe("task_orchestration");
  });

  it('maps "task.assigned" to "task_orchestration"', () => {
    expect(EVENT_TO_CHANNEL["task.assigned"]).toBe("task_orchestration");
  });

  it('maps "task.status_changed" to "task_orchestration"', () => {
    expect(EVENT_TO_CHANNEL["task.status_changed"]).toBe("task_orchestration");
  });

  it('maps "task.completed" to "task_orchestration"', () => {
    expect(EVENT_TO_CHANNEL["task.completed"]).toBe("task_orchestration");
  });

  it('maps "task.failed" to "task_orchestration"', () => {
    expect(EVENT_TO_CHANNEL["task.failed"]).toBe("task_orchestration");
  });

  it('maps "task.progress" to "task_orchestration"', () => {
    expect(EVENT_TO_CHANNEL["task.progress"]).toBe("task_orchestration");
  });

  it('maps "topology.updated" to "topology"', () => {
    expect(EVENT_TO_CHANNEL["topology.updated"]).toBe("topology");
  });

  it('maps "topology.rebalanced" to "topology"', () => {
    expect(EVENT_TO_CHANNEL["topology.rebalanced"]).toBe("topology");
  });

  it('maps "topology.leader_elected" to "topology"', () => {
    expect(EVENT_TO_CHANNEL["topology.leader_elected"]).toBe("topology");
  });

  it('maps "consensus.proposed" to "consensus"', () => {
    expect(EVENT_TO_CHANNEL["consensus.proposed"]).toBe("consensus");
  });

  it('maps "consensus.vote_cast" to "consensus"', () => {
    expect(EVENT_TO_CHANNEL["consensus.vote_cast"]).toBe("consensus");
  });

  it('maps "consensus.resolved" to "consensus"', () => {
    expect(EVENT_TO_CHANNEL["consensus.resolved"]).toBe("consensus");
  });

  it('maps "memory.store" to "memory"', () => {
    expect(EVENT_TO_CHANNEL["memory.store"]).toBe("memory");
  });

  it('maps "memory.search" to "memory"', () => {
    expect(EVENT_TO_CHANNEL["memory.search"]).toBe("memory");
  });

  it('maps "hooks.triggered" to "hooks"', () => {
    expect(EVENT_TO_CHANNEL["hooks.triggered"]).toBe("hooks");
  });

  it('maps "hooks.completed" to "hooks"', () => {
    expect(EVENT_TO_CHANNEL["hooks.completed"]).toBe("hooks");
  });

  it("covers all 20 SwarmEngineEventMap keys", () => {
    expect(Object.keys(EVENT_TO_CHANNEL)).toHaveLength(20);
  });
});

// ============================================================================
// CHANNEL_TO_TOPIC_SUFFIX
// ============================================================================

describe("CHANNEL_TO_TOPIC_SUFFIX", () => {
  it('maps "agent_lifecycle" to "agents"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["agent_lifecycle"]).toBe("agents");
  });

  it('maps "task_orchestration" to "tasks"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["task_orchestration"]).toBe("tasks");
  });

  it('maps "topology" to "topology"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["topology"]).toBe("topology");
  });

  it('maps "consensus" to "consensus"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["consensus"]).toBe("consensus");
  });

  it('maps "memory" to "memory"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["memory"]).toBe("memory");
  });

  it('maps "hooks" to "hooks"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["hooks"]).toBe("hooks");
  });

  it('maps "intel" to "intel"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["intel"]).toBe("intel");
  });

  it('maps "signal" to "signals"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["signal"]).toBe("signals");
  });

  it('maps "detection" to "detections"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["detection"]).toBe("detections");
  });

  it('maps "coordination" to "coordination"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["coordination"]).toBe("coordination");
  });

  it('maps "status" to "status"', () => {
    expect(CHANNEL_TO_TOPIC_SUFFIX["status"]).toBe("status");
  });
});

// ============================================================================
// ProtocolBridge
// ============================================================================

describe("ProtocolBridge", () => {
  function createBridge() {
    const emitter = new TypedEventEmitter<SwarmEngineEventMap>();
    const published: Array<{ topic: string; envelope: SwarmEngineEnvelope }> = [];
    const publish = vi.fn(async (topic: string, envelope: SwarmEngineEnvelope) => {
      published.push({ topic, envelope });
    });
    const config: ProtocolBridgeConfig = {
      swarmId: "swe_test123",
      publish,
    };
    const bridge = new ProtocolBridge(emitter, config);
    return { emitter, published, publish, bridge };
  }

  it("connect() subscribes to all mapped events", () => {
    const { emitter, bridge } = createBridge();
    bridge.connect();
    // There should be 20 listeners (one per EVENT_TO_CHANNEL key)
    const totalListeners = Object.keys(EVENT_TO_CHANNEL).reduce(
      (sum, key) => sum + emitter.listenerCount(key as keyof SwarmEngineEventMap),
      0,
    );
    expect(totalListeners).toBe(20);
    bridge.disconnect();
  });

  it("emits correct envelope when agent.spawned fires", async () => {
    const { emitter, published, bridge } = createBridge();
    bridge.connect();
    const event = {
      kind: "agent.spawned" as const,
      agent: makeAgentSession(),
      receipt: null,
      sourceAgentId: null,
      timestamp: Date.now(),
    };
    emitter.emit("agent.spawned", event);
    // Allow microtask to process
    await vi.waitFor(() => expect(published).toHaveLength(1));
    const { topic, envelope } = published[0]!;
    expect(topic).toBe("/baychat/v1/swarm/swe_test123/agents");
    expect(envelope.version).toBe(1);
    expect(envelope.type).toBe("agent_lifecycle");
    expect(envelope.payload).toBe(event);
    expect(envelope.ttl).toBe(5);
    expect(typeof envelope.created).toBe("number");
    bridge.disconnect();
  });

  it("envelope has version=1, correct type, payload=event, ttl=defaultTtl, created=timestamp", async () => {
    const { emitter, published, bridge } = createBridge();
    bridge.connect();
    const now = Date.now();
    const event = {
      kind: "task.created" as const,
      task: {
        id: "tsk_01HXKTEST000000000000000",
        swarmEngineId: "swe_test",
        type: "coding" as const,
        name: "test task",
        description: "desc",
        priority: "normal" as const,
        status: "created" as const,
        sequence: 1,
        assignedTo: null,
        dependencies: [],
        input: {},
        output: null,
        timeoutMs: 0,
        retries: 0,
        maxRetries: 3,
        taskPrompt: null,
        previewLines: [],
        huntId: null,
        artifactIds: [],
        receipt: null,
        metadata: {},
        createdAt: now,
        startedAt: null,
        completedAt: null,
        updatedAt: now,
      },
      sourceAgentId: null,
      timestamp: now,
    };
    emitter.emit("task.created", event);
    await vi.waitFor(() => expect(published).toHaveLength(1));
    const { envelope } = published[0]!;
    expect(envelope.version).toBe(1);
    expect(envelope.type).toBe("task_orchestration");
    expect(envelope.payload).toBe(event);
    expect(envelope.ttl).toBe(5);
    expect(envelope.created).toBeGreaterThanOrEqual(now);
    bridge.disconnect();
  });

  it("disconnect() removes all subscriptions", () => {
    const { emitter, bridge } = createBridge();
    bridge.connect();
    bridge.disconnect();
    const totalListeners = Object.keys(EVENT_TO_CHANNEL).reduce(
      (sum, key) => sum + emitter.listenerCount(key as keyof SwarmEngineEventMap),
      0,
    );
    expect(totalListeners).toBe(0);
  });

  it("dispose() calls disconnect()", () => {
    const { emitter, bridge } = createBridge();
    bridge.connect();
    bridge.dispose();
    const totalListeners = Object.keys(EVENT_TO_CHANNEL).reduce(
      (sum, key) => sum + emitter.listenerCount(key as keyof SwarmEngineEventMap),
      0,
    );
    expect(totalListeners).toBe(0);
  });

  it("publish errors are swallowed", async () => {
    const emitter = new TypedEventEmitter<SwarmEngineEventMap>();
    const publish = vi.fn(async () => {
      throw new Error("transport failure");
    });
    const config: ProtocolBridgeConfig = {
      swarmId: "swe_test",
      publish,
    };
    const bridge = new ProtocolBridge(emitter, config);
    bridge.connect();
    // This should NOT throw
    const event = {
      kind: "agent.heartbeat" as const,
      agentId: "agt_test",
      health: 1,
      workload: 0,
      metricsSnapshot: makeAgentMetrics(),
      sourceAgentId: "agt_test",
      timestamp: Date.now(),
    };
    emitter.emit("agent.heartbeat", event);
    // Wait for promise rejection to be swallowed
    await new Promise((r) => setTimeout(r, 10));
    expect(publish).toHaveBeenCalledOnce();
    bridge.disconnect();
  });

  it("bridge TTL defaults to 5 if not configured", () => {
    const emitter = new TypedEventEmitter<SwarmEngineEventMap>();
    const config: ProtocolBridgeConfig = {
      swarmId: "swe_test",
      publish: vi.fn(async () => {}),
    };
    const bridge = new ProtocolBridge(emitter, config);
    bridge.connect();
    // We verified via the envelope test above that ttl=5
    bridge.disconnect();
  });

  it("bridge uses custom TTL when configured", async () => {
    const emitter = new TypedEventEmitter<SwarmEngineEventMap>();
    const published: SwarmEngineEnvelope[] = [];
    const config: ProtocolBridgeConfig = {
      swarmId: "swe_test",
      publish: vi.fn(async (_topic: string, envelope: SwarmEngineEnvelope) => {
        published.push(envelope);
      }),
      defaultTtl: 10,
    };
    const bridge = new ProtocolBridge(emitter, config);
    bridge.connect();
    const event = {
      kind: "memory.store" as const,
      namespace: "test",
      key: "k",
      sizeBytes: 42,
      sourceAgentId: null,
      timestamp: Date.now(),
    };
    emitter.emit("memory.store", event);
    await vi.waitFor(() => expect(published).toHaveLength(1));
    expect(published[0]!.ttl).toBe(10);
    bridge.disconnect();
  });
});
