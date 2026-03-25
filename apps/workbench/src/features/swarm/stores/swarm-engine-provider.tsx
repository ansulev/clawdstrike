/**
 * SwarmEngineProvider -- React context provider that manages the lifecycle of a
 * SwarmOrchestrator instance from @clawdstrike/swarm-engine.
 *
 * Provides:
 * - Engine initialization on mount with error fallback (mode="error")
 * - Cleanup via shutdown() on unmount (NOT dispose -- Pitfall 8)
 * - React strict mode double-mount guard via `cancelled` boolean
 * - Convenience hooks: useSwarmEngine, useAgentRegistry, useTaskGraph, useTopology
 *
 * When `enabled` is false, the provider operates in manual mode: all hooks
 * return null and the existing SwarmBoard works as-is with no engine overhead.
 *
 * @module
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  SwarmOrchestrator,
  TypedEventEmitter,
  AgentRegistry,
  TaskGraph,
  TopologyManager,
  type SwarmEngineEventMap,
  type SwarmOrchestratorConfig,
} from "@clawdstrike/swarm-engine";

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------

export interface SwarmEngineContextValue {
  engine: SwarmOrchestrator | null;
  agentRegistry: AgentRegistry | null;
  taskGraph: TaskGraph | null;
  topology: TopologyManager | null;
  isReady: boolean;
  /** "engine" = orchestrator running, "manual" = fallback/disabled, "error" = init failed */
  mode: "engine" | "manual" | "error";
  /** Non-null when mode === "error". Describes what went wrong. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SwarmEngineContext = createContext<SwarmEngineContextValue | null>(null);

// ---------------------------------------------------------------------------
// Default config for the workbench orchestrator
// ---------------------------------------------------------------------------

const WORKBENCH_CONFIG: SwarmOrchestratorConfig = {
  namespace: "workbench",
  topology: {
    type: "mesh",
    partitionStrategy: "round-robin",
    maxAgents: 50,
    replicationFactor: 1,
    failoverEnabled: true,
    autoRebalance: true,
  },
  consensus: {
    algorithm: "raft",
    threshold: 0.5,
    timeoutMs: 30_000,
    maxRounds: 5,
    requireQuorum: true,
  },
  pool: {
    minSize: 0,
    maxSize: 20,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.2,
    cooldownMs: 5000,
  },
  maxAgents: 50,
  maxTasks: 200,
  heartbeatIntervalMs: 5000,
  healthCheckIntervalMs: 10_000,
  taskTimeoutMs: 300_000,
  maxGuardActionHistory: 100,
};

// ---------------------------------------------------------------------------
// Initial context value (manual/disabled state)
// ---------------------------------------------------------------------------

const MANUAL_CONTEXT: SwarmEngineContextValue = {
  engine: null,
  agentRegistry: null,
  taskGraph: null,
  topology: null,
  isReady: false,
  mode: "manual",
  error: null,
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface SwarmEngineProviderProps {
  children: ReactNode;
  /** When false, no engine is created and all hooks return null (manual mode). */
  enabled?: boolean;
}

export function SwarmEngineProvider({
  children,
  enabled = true,
}: SwarmEngineProviderProps) {
  const [contextValue, setContextValue] =
    useState<SwarmEngineContextValue>(MANUAL_CONTEXT);

  const engineRef = useRef<SwarmOrchestrator | null>(null);

  useEffect(() => {
    if (!enabled) {
      setContextValue(MANUAL_CONTEXT);
      return;
    }

    let cancelled = false; // React strict mode double-mount guard (PITFALL 2)

    try {
      const events = new TypedEventEmitter<SwarmEngineEventMap>();
      const registry = new AgentRegistry(events);
      const taskGraph = new TaskGraph(events, registry);
      const topologyMgr = new TopologyManager(events);

      const orchestrator = new SwarmOrchestrator(
        events,
        registry,
        taskGraph,
        topologyMgr,
        WORKBENCH_CONFIG,
      );
      orchestrator.initialize(); // synchronous -- throws on failure (PITFALL 5)

      if (cancelled) {
        orchestrator.shutdown();
        return;
      }

      engineRef.current = orchestrator;
      setContextValue({
        engine: orchestrator,
        agentRegistry: registry,
        taskGraph,
        topology: topologyMgr,
        isReady: true,
        mode: "engine",
        error: null,
      });
    } catch (err) {
      if (cancelled) return;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        "[SwarmEngineProvider] Engine init failed, falling back to manual mode:",
        message,
      );
      engineRef.current = null;
      setContextValue({
        engine: null,
        agentRegistry: null,
        taskGraph: null,
        topology: null,
        isReady: false,
        mode: "error",
        error: message,
      });
    }

    return () => {
      cancelled = true;
      if (engineRef.current) {
        engineRef.current.shutdown(); // NOT dispose -- Pitfall 8
        engineRef.current = null;
      }
    };
  }, [enabled]);

  return (
    <SwarmEngineContext.Provider value={contextValue}>
      {children}
    </SwarmEngineContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

/**
 * Returns the full SwarmEngine context value.
 * Throws if called outside of SwarmEngineProvider.
 */
export function useSwarmEngine(): SwarmEngineContextValue {
  const ctx = useContext(SwarmEngineContext);
  if (ctx === null) {
    throw new Error(
      "useSwarmEngine must be used within a <SwarmEngineProvider>. " +
        "Wrap your component tree with SwarmEngineProvider.",
    );
  }
  return ctx;
}

/**
 * Returns the AgentRegistry from the engine context, or null if engine is not ready.
 * Throws if called outside of SwarmEngineProvider.
 */
export function useAgentRegistry(): AgentRegistry | null {
  return useSwarmEngine().agentRegistry;
}

/**
 * Returns the TaskGraph from the engine context, or null if engine is not ready.
 * Throws if called outside of SwarmEngineProvider.
 */
export function useTaskGraph(): TaskGraph | null {
  return useSwarmEngine().taskGraph;
}

/**
 * Returns the TopologyManager from the engine context, or null if engine is not ready.
 * Throws if called outside of SwarmEngineProvider.
 */
export function useTopology(): TopologyManager | null {
  return useSwarmEngine().topology;
}
