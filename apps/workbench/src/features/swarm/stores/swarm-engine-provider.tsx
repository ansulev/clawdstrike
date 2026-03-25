/**
 * React context provider for SwarmOrchestrator lifecycle and guard-gated session spawning.
 * When `enabled` is false, operates in manual mode with no engine overhead.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Node } from "@xyflow/react";
import {
  SwarmOrchestrator,
  TypedEventEmitter,
  AgentRegistry,
  TaskGraph,
  TopologyManager,
  type GuardedAction,
  type SwarmEngineEventMap,
  type SwarmEngineState,
  type SwarmOrchestratorConfig,
} from "@clawdstrike/swarm-engine";
import type { SwarmBoardNodeData } from "../swarm-board-types";
import {
  useSwarmBoardStore,
  type SpawnSessionOptions,
  type SpawnClaudeSessionOptions,
  type SpawnWorktreeSessionOptions,
} from "./swarm-board-store";
import { workbenchGuardEvaluator } from "./workbench-guard-evaluator";

export interface SwarmEngineContextValue {
  engine: SwarmOrchestrator | null;
  /** @deprecated Use engine.getState().agents instead. Kept for migration. */
  agentRegistry: AgentRegistry | null;
  /** @deprecated Use engine.getState().tasks instead. Kept for migration. */
  taskGraph: TaskGraph | null;
  /** @deprecated Use engine.getState().topology instead. Kept for migration. */
  topology: TopologyManager | null;
  isReady: boolean;
  mode: "engine" | "manual" | "error";
  error: string | null;
  spawnEngineSession: (
    spawnFn: (opts: SpawnSessionOptions) => Promise<Node<SwarmBoardNodeData>>,
    opts: SpawnSessionOptions,
  ) => Promise<Node<SwarmBoardNodeData>>;
  spawnEngineClaudeSession: (
    spawnFn: (opts: SpawnClaudeSessionOptions) => Promise<Node<SwarmBoardNodeData>>,
    opts: SpawnClaudeSessionOptions,
  ) => Promise<Node<SwarmBoardNodeData>>;
  spawnEngineWorktreeSession: (
    spawnFn: (opts: SpawnWorktreeSessionOptions) => Promise<Node<SwarmBoardNodeData>>,
    opts: SpawnWorktreeSessionOptions,
  ) => Promise<Node<SwarmBoardNodeData>>;
}

type SwarmEngineContextState = Omit<
  SwarmEngineContextValue,
  "spawnEngineSession" | "spawnEngineClaudeSession" | "spawnEngineWorktreeSession"
>;

const SwarmEngineContext = createContext<SwarmEngineContextValue | null>(null);

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
  guardEvaluator: workbenchGuardEvaluator,
};

const MANUAL_CONTEXT_STATE: SwarmEngineContextState = {
  engine: null,
  agentRegistry: null,
  taskGraph: null,
  topology: null,
  isReady: false,
  mode: "manual",
  error: null,
};

interface PositionedSpawnOptions {
  position?: { x: number; y: number };
}

function fallbackSpawnPosition(
  position?: { x: number; y: number },
): { x: number; y: number } {
  return position ?? {
    x: 100 + Math.random() * 400,
    y: 100 + Math.random() * 300,
  };
}

function receiptNodeFromGuardResult(
  opts: PositionedSpawnOptions,
  verdict: "allow" | "deny" | "warn",
  guardResults: Array<{ guard: string; allowed: boolean; duration_ms?: number }>,
  signature?: string,
  publicKey?: string,
  detail?: string,
): Node<SwarmBoardNodeData> {
  const { actions } = useSwarmBoardStore.getState();
  const position = fallbackSpawnPosition(opts.position);

  return actions.addNode({
    nodeType: "receipt",
    title: `Guard: ${verdict.toUpperCase()}`,
    position: { x: position.x, y: position.y + 340 },
    data: {
      verdict,
      guardResults,
      signature,
      publicKey,
      status: "completed",
      engineManaged: true,
      ...(detail ? { previewLines: [detail] } : {}),
    },
  });
}

function buildSpawnGuardAction(
  kind: "terminal" | "claude" | "worktree",
  opts: SpawnSessionOptions | SpawnClaudeSessionOptions | SpawnWorktreeSessionOptions,
): GuardedAction {
  const repoRoot = useSwarmBoardStore.getState().repoRoot || "/tmp";

  if (kind === "terminal") {
    const terminalOpts = opts as SpawnSessionOptions;
    return {
      agentId: `pending_${Date.now()}`,
      taskId: null,
      actionType: "shell_command",
      target:
        terminalOpts.command ??
        (terminalOpts.launchClaude ? "claude" : terminalOpts.shell ?? "shell"),
      context: {
        operation: "agent_spawn",
        cwd: terminalOpts.cwd,
        launchClaude: terminalOpts.launchClaude ?? false,
        command: terminalOpts.command ?? null,
      },
      requestedAt: Date.now(),
    };
  }

  if (kind === "claude") {
    const claudeOpts = opts as SpawnClaudeSessionOptions;
    return {
      agentId: `pending_${Date.now()}`,
      taskId: null,
      actionType: "shell_command",
      target: "claude",
      context: {
        operation: "claude_spawn",
        cwd: claudeOpts.cwd ?? repoRoot,
        worktree: claudeOpts.worktree ?? false,
        branch: claudeOpts.branch ?? null,
        prompt: claudeOpts.prompt ?? null,
      },
      requestedAt: Date.now(),
    };
  }

  const worktreeOpts = opts as SpawnWorktreeSessionOptions;
  return {
    agentId: `pending_${Date.now()}`,
    taskId: null,
    actionType: "shell_command",
    target: `git worktree add ${worktreeOpts.branch ?? "(auto)"}`,
    context: {
      operation: "worktree_spawn",
      cwd: repoRoot,
      branch: worktreeOpts.branch ?? null,
      shell: worktreeOpts.shell ?? null,
    },
    requestedAt: Date.now(),
  };
}

export interface SwarmEngineProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

export function SwarmEngineProvider({
  children,
  enabled = true,
}: SwarmEngineProviderProps) {
  const [contextState, setContextState] =
    useState<SwarmEngineContextState>(MANUAL_CONTEXT_STATE);

  const engineRef = useRef<SwarmOrchestrator | null>(null);

  useEffect(() => {
    if (!enabled) {
      setContextState(MANUAL_CONTEXT_STATE);
      return;
    }

    let cancelled = false;
    let orchestrator: SwarmOrchestrator | null = null;

    try {
      const events = new TypedEventEmitter<SwarmEngineEventMap>();
      const registry = new AgentRegistry(events);
      const taskGraph = new TaskGraph(events, registry);
      const topologyMgr = new TopologyManager(events);

      orchestrator = new SwarmOrchestrator(
        events,
        registry,
        taskGraph,
        topologyMgr,
        WORKBENCH_CONFIG,
      );
      orchestrator.initialize();

      if (cancelled) {
        orchestrator.shutdown();
        orchestrator = null;
        return;
      }

      engineRef.current = orchestrator;
      setContextState({
        engine: orchestrator,
        agentRegistry: registry,
        taskGraph,
        topology: topologyMgr,
        isReady: true,
        mode: "engine",
        error: null,
      });
    } catch (err) {
      orchestrator?.shutdown();
      orchestrator = null;
      if (cancelled) return;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        "[SwarmEngineProvider] Engine init failed, falling back to manual mode:",
        message,
      );
      engineRef.current = null;
      setContextState({
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
      const activeEngine = engineRef.current ?? orchestrator;
      activeEngine?.shutdown();
      engineRef.current = null;
      orchestrator = null;
    };
  }, [enabled]);

  const finalizeAllowedSpawn = useCallback((
    nodeId: string,
    result: Awaited<ReturnType<SwarmOrchestrator["evaluateGuard"]>>,
  ): void => {
    const { actions } = useSwarmBoardStore.getState();
    actions.guardEvaluate(
      nodeId,
      result.verdict,
      result.guardResults.map((guardResult) => ({
        guard: guardResult.guardId,
        allowed: guardResult.verdict !== "deny",
        duration_ms: guardResult.duration_ms,
      })),
      result.receipt.signature,
      result.receipt.publicKey,
    );
  }, []);

  const runGuardedSpawn = useCallback(
    async function <Opts extends PositionedSpawnOptions>(
      kind: "terminal" | "claude" | "worktree",
      spawnFn: (opts: Opts) => Promise<Node<SwarmBoardNodeData>>,
      opts: Opts,
    ): Promise<Node<SwarmBoardNodeData>> {
      const engine = engineRef.current;
      if (!engine) {
        return spawnFn(opts);
      }

      let result: Awaited<ReturnType<SwarmOrchestrator["evaluateGuard"]>>;
      try {
        result = await engine.evaluateGuard(buildSpawnGuardAction(kind, opts));
      } catch (guardErr) {
        const message =
          guardErr instanceof Error ? guardErr.message : String(guardErr);
        console.warn(
          "[SwarmEngineProvider] Guard evaluation failed; denying spawn:",
          message,
        );

        return receiptNodeFromGuardResult(
          opts,
          "deny",
          [{ guard: "engine_error", allowed: false }],
          undefined,
          undefined,
          message,
        );
      }

      if (!result.allowed) {
        return receiptNodeFromGuardResult(
          opts,
          result.verdict,
          result.guardResults.map((guardResult) => ({
            guard: guardResult.guardId,
            allowed: guardResult.verdict !== "deny",
            duration_ms: guardResult.duration_ms,
          })),
          result.receipt.signature,
          result.receipt.publicKey,
        );
      }

      const node = await spawnFn(opts);
      finalizeAllowedSpawn(node.id, result);
      return node;
    },
    [finalizeAllowedSpawn],
  );

  const spawnEngineSession = useCallback(
    async (
      spawnFn: (opts: SpawnSessionOptions) => Promise<Node<SwarmBoardNodeData>>,
      opts: SpawnSessionOptions,
    ): Promise<Node<SwarmBoardNodeData>> =>
      runGuardedSpawn("terminal", spawnFn, opts),
    [runGuardedSpawn],
  );

  const spawnEngineClaudeSession = useCallback(
    async (
      spawnFn: (opts: SpawnClaudeSessionOptions) => Promise<Node<SwarmBoardNodeData>>,
      opts: SpawnClaudeSessionOptions,
    ): Promise<Node<SwarmBoardNodeData>> =>
      runGuardedSpawn("claude", spawnFn, opts),
    [runGuardedSpawn],
  );

  const spawnEngineWorktreeSession = useCallback(
    async (
      spawnFn: (opts: SpawnWorktreeSessionOptions) => Promise<Node<SwarmBoardNodeData>>,
      opts: SpawnWorktreeSessionOptions,
    ): Promise<Node<SwarmBoardNodeData>> =>
      runGuardedSpawn("worktree", spawnFn, opts),
    [runGuardedSpawn],
  );

  const valueWithSpawn = useMemo(
    () => ({
      ...contextState,
      spawnEngineSession,
      spawnEngineClaudeSession,
      spawnEngineWorktreeSession,
    }),
    [
      contextState,
      spawnEngineSession,
      spawnEngineClaudeSession,
      spawnEngineWorktreeSession,
    ],
  );

  return (
    <SwarmEngineContext.Provider value={valueWithSpawn}>
      {children}
    </SwarmEngineContext.Provider>
  );
}

/** Throws if called outside SwarmEngineProvider. */
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

/** Returns null if no provider is mounted (safe for compatibility layers). */
export function useOptionalSwarmEngine(): SwarmEngineContextValue | null {
  return useContext(SwarmEngineContext);
}

/** @deprecated Use `useSwarmEngine().engine?.getState().agents` instead. */
export function useAgentRegistry(): ReturnType<AgentRegistry["getState"]> | null {
  const { engine } = useSwarmEngine();
  return engine?.getState().agents ?? null;
}

/** @deprecated Use `useSwarmEngine().engine?.getState().tasks` instead. */
export function useTaskGraph(): ReturnType<TaskGraph["getState"]> | null {
  const { engine } = useSwarmEngine();
  return engine?.getState().tasks ?? null;
}

/** @deprecated Use `useSwarmEngine().engine?.getState().topology` instead. */
export function useTopology(): SwarmEngineState["topology"] | null {
  const { engine } = useSwarmEngine();
  return engine?.getState().topology ?? null;
}
