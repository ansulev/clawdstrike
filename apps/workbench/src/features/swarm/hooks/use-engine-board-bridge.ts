/**
 * useEngineBoardBridge -- React hook that bridges SwarmOrchestrator's
 * TypedEventEmitter events to the Zustand board store.
 *
 * Maps engine lifecycle, task, topology, and guard events to board node
 * creation, status updates, layout repositioning, and receipt nodes.
 *
 * Follows the same pattern as useCoordinatorBoardBridge:
 * - Subscribe in useEffect
 * - Dedup by agentId/taskId before creating nodes (INTG-08)
 * - Call useSwarmBoardStore.getState().actions.* (not hook selectors)
 * - Clean up on unmount
 *
 * Additionally implements the evaluating glow pattern from
 * usePolicyEvalBoardBridge for guard.evaluated events (INTG-09).
 */

import { useEffect, useRef } from "react";
import type { SwarmOrchestrator } from "@clawdstrike/swarm-engine";
import { useSwarmBoardStore } from "@/features/swarm/stores/swarm-board-store";
import type {
  SwarmBoardEdge,
  SwarmBoardNodeData,
  SessionStatus,
} from "@/features/swarm/swarm-board-types";
import type { Node } from "@xyflow/react";
import { computeLayout } from "@/features/swarm/layout/topology-layout";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Duration in ms that the evaluating glow remains visible. */
const EVAL_GLOW_DURATION_MS = 2000;

// ---------------------------------------------------------------------------
// Position helper
// ---------------------------------------------------------------------------

/**
 * Calculate a position for a new auto-created node, placing it to the right
 * of the rightmost existing node with slight vertical jitter.
 * Copied from use-coordinator-board-bridge.ts lines 36-44.
 */
function nextNodePosition(
  nodes: Array<{ position: { x: number; y: number } }>,
): { x: number; y: number } {
  if (nodes.length === 0) return { x: 200, y: 200 };
  const maxX = Math.max(...nodes.map((n) => n.position.x));
  const avgY =
    nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length;
  return { x: maxX + 320, y: avgY + (Math.random() - 0.5) * 100 };
}

// ---------------------------------------------------------------------------
// Status mapping: engine AgentSessionStatus -> board SessionStatus
// ---------------------------------------------------------------------------

function mapEngineStatus(engineStatus: string): SessionStatus {
  switch (engineStatus) {
    case "running":
      return "running";
    case "idle":
      return "idle";
    case "busy":
      return "running";
    case "terminated":
      return "completed";
    case "offline":
      return "failed";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "blocked":
      return "blocked";
    case "evaluating":
      return "evaluating";
    default:
      return "running";
  }
}

function seedBoardFromEngineSnapshot(engine: SwarmOrchestrator): void {
  const snapshot = engine.getState();
  const { actions } = useSwarmBoardStore.getState();

  const topologyNodeById = new Map(
    snapshot.topology.nodes.map((topologyNode) => [topologyNode.id, topologyNode]),
  );
  const agentPositions = new Map(
    snapshot.topology.nodes
      .filter(
        (topologyNode) =>
          topologyNode.positionX !== null && topologyNode.positionY !== null,
      )
      .map((topologyNode) => [
        topologyNode.agentId,
        { x: topologyNode.positionX ?? 0, y: topologyNode.positionY ?? 0 },
      ]),
  );

  const agentNodes = Object.values(snapshot.agents).map((agent) => ({
    id: agent.id,
    agentId: agent.id,
    data: {
      nodeType: "agentSession" as const,
      title: agent.name,
      status: mapEngineStatus(agent.status),
      agentId: agent.id,
      agentModel: agent.agentModel ?? agent.role,
      branch: agent.branch ?? undefined,
      worktreePath: agent.worktreePath ?? undefined,
      risk: agent.risk,
      policyMode: agent.policyMode ?? undefined,
      receiptCount: agent.receiptCount,
      blockedActionCount: agent.blockedActionCount,
      changedFilesCount: agent.changedFilesCount,
      filesTouched: agent.filesTouched,
      toolBoundaryEvents: agent.toolBoundaryEvents,
      confidence: agent.confidence ?? undefined,
      engineManaged: true,
    },
    position: agentPositions.get(agent.id),
  }));

  const taskNodes = Object.values(snapshot.tasks).map((task, index) => {
    const agentPosition = task.assignedTo
      ? agentPositions.get(task.assignedTo)
      : undefined;
    return {
      id: task.id,
      taskId: task.id,
      agentId: task.assignedTo ?? undefined,
      data: {
        nodeType: "terminalTask" as const,
        title: task.type ?? task.name ?? "Task",
        status: mapEngineStatus(task.status),
        taskId: task.id,
        agentId: task.assignedTo ?? undefined,
        engineManaged: true,
        taskPrompt: task.taskPrompt ?? task.description,
        previewLines: task.previewLines,
      },
      position: agentPosition
        ? { x: agentPosition.x, y: agentPosition.y + 200 + index * 24 }
        : undefined,
    };
  });

  const taskEdges = Object.values(snapshot.tasks)
    .filter((task) => task.assignedTo)
    .map((task) => ({
      id: `edge-spawn-${task.id}`,
      source: task.assignedTo!,
      target: task.id,
      type: "spawned" as const,
    }));

  const topologyEdges = snapshot.topology.edges.map((topologyEdge) => {
    const fromNode = topologyNodeById.get(topologyEdge.from);
    const toNode = topologyNodeById.get(topologyEdge.to);
    return {
      id: `edge-topo-${topologyEdge.from}-${topologyEdge.to}`,
      source: fromNode?.agentId ?? topologyEdge.from,
      target: toNode?.agentId ?? topologyEdge.to,
      type: "topology" as const,
    };
  });

  actions.engineSync(
    [...agentNodes, ...taskNodes],
    [...taskEdges, ...topologyEdges],
  );
}

function buildTopologyEdges(
  nodes: Node<SwarmBoardNodeData>[],
  topologyEdges: Array<{ from: string; to: string }> | undefined,
): SwarmBoardEdge[] {
  if (!topologyEdges?.length) {
    return [];
  }

  return topologyEdges.flatMap((topologyEdge) => {
    const fromNode = nodes.find(
      (node) =>
        node.data.agentId === topologyEdge.from || node.id === topologyEdge.from,
    );
    const toNode = nodes.find(
      (node) =>
        node.data.agentId === topologyEdge.to || node.id === topologyEdge.to,
    );

    if (!fromNode || !toNode) {
      return [];
    }

    return [{
      id: `edge-topo-${topologyEdge.from}-${topologyEdge.to}`,
      source: fromNode.id,
      target: toNode.id,
      type: "topology",
    }];
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Bridge SwarmOrchestrator engine events to the Zustand board store.
 *
 * @param engine - The SwarmOrchestrator instance, or null if unavailable.
 */
export function useEngineBoardBridge(engine: SwarmOrchestrator | null): void {
  // Glow tracking refs (matching usePolicyEvalBoardBridge exactly)
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const restoreStatusRef = useRef<Map<string, SessionStatus>>(new Map());

  useEffect(() => {
    if (!engine) return;

    const store = useSwarmBoardStore.getState;
    const unsubs: Array<() => void> = [];
    const timeouts = timeoutsRef.current;
    const restoreStatuses = restoreStatusRef.current;

    // Access the shared event emitter via the orchestrator's public accessor.
    const events = engine.getEvents();
    seedBoardFromEngineSnapshot(engine);

    // -----------------------------------------------------------------------
    // 1. agent.spawned -> addNode({ nodeType: "agentSession" }) (INTG-02, INTG-08)
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("agent.spawned", (event: any) => {
        const { nodes, actions } = store();

        // Dedup: skip if a node with this agentId already exists
        if (nodes.some((n: Node<SwarmBoardNodeData>) => n.data.agentId === event.agent.id)) return;

        const position = nextNodePosition(nodes);

        actions.addNode({
          nodeType: "agentSession",
          title: event.agent.name ?? event.agent.id,
          position,
          data: {
            nodeType: "agentSession",
            title: event.agent.name ?? event.agent.id,
            status: "idle",
            agentId: event.agent.id,
            agentModel: event.agent.role,
            engineManaged: true,
          },
        });
      }),
    );

    // -----------------------------------------------------------------------
    // 2. agent.status_changed -> updateNode (INTG-02)
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("agent.status_changed", (event: any) => {
        const { nodes, actions } = store();

        const node = nodes.find(
          (n: Node<SwarmBoardNodeData>) => n.data.agentId === event.agentId,
        );
        if (!node) return;

        const mappedStatus = mapEngineStatus(event.newStatus);
        actions.updateNode(node.id, { status: mappedStatus });
      }),
    );

    // -----------------------------------------------------------------------
    // 3. agent.heartbeat -> updateNode (INTG-02)
    //    Engine-managed nodes don't have a sessionId, so setSessionMetadata
    //    (which matches by sessionId) would be a no-op. Use updateNode which
    //    matches by node.id directly.
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("agent.heartbeat", (event: any) => {
        const { nodes, actions } = store();

        const node = nodes.find(
          (n: Node<SwarmBoardNodeData>) => n.data.agentId === event.agentId,
        );
        if (!node) return;

        actions.updateNode(node.id, {
          toolBoundaryEvents: event.metricsSnapshot?.tasksCompleted,
          confidence: Math.round((event.health ?? 0) * 100),
        });
      }),
    );

    // -----------------------------------------------------------------------
    // 4. agent.terminated -> updateNode({ status: "completed" }) (INTG-02)
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("agent.terminated", (event: any) => {
        const { nodes, actions } = store();

        const node = nodes.find(
          (n: Node<SwarmBoardNodeData>) => n.data.agentId === event.agentId,
        );
        if (!node) return;

        actions.updateNode(node.id, {
          status: "completed",
          exitCode: event.exitCode,
        });
      }),
    );

    // -----------------------------------------------------------------------
    // 5. task.created -> addNode({ nodeType: "terminalTask" }) + addEdge (INTG-02, INTG-08)
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("task.created", (event: any) => {
        const { nodes, actions } = store();

        // Dedup: skip if a node with this taskId already exists
        if (nodes.some((n: Node<SwarmBoardNodeData>) => n.data.taskId === event.task.id)) return;

        // Find parent agent node by assignedTo
        const parentNode = nodes.find(
          (n: Node<SwarmBoardNodeData>) =>
            n.data.agentId === event.task.assignedTo,
        );

        // Position: below parent if found, else nextNodePosition
        const position = parentNode
          ? { x: parentNode.position.x, y: parentNode.position.y + 200 }
          : nextNodePosition(nodes);

        const taskNode = actions.addNode({
          nodeType: "terminalTask",
          title: event.task.type ?? event.task.name ?? "Task",
          position,
          data: {
            nodeType: "terminalTask",
            title: event.task.type ?? event.task.name ?? "Task",
            status: "running",
            taskId: event.task.id,
            agentId: event.task.assignedTo,
            engineManaged: true,
            taskPrompt: event.task.type,
          },
        });

        // Add spawned edge from parent agent to task
        if (parentNode) {
          actions.addEdge({
            id: `edge-spawn-${taskNode.id}`,
            source: parentNode.id,
            target: taskNode.id,
            type: "spawned",
          });
        }
      }),
    );

    // -----------------------------------------------------------------------
    // 6. task.completed -> updateNode (INTG-02)
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("task.completed", (event: any) => {
        const { nodes, actions } = store();

        const taskNode = nodes.find(
          (n: Node<SwarmBoardNodeData>) => n.data.taskId === event.taskId,
        );
        if (!taskNode) return;

        actions.updateNode(taskNode.id, { status: "completed" });
      }),
    );

    // -----------------------------------------------------------------------
    // 7. task.failed -> updateNode({ status: "failed" }) (INTG-02)
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("task.failed", (event: any) => {
        const { nodes, actions } = store();

        const taskNode = nodes.find(
          (n: Node<SwarmBoardNodeData>) => n.data.taskId === event.taskId,
        );
        if (!taskNode) return;

        actions.updateNode(taskNode.id, { status: "failed" });
      }),
    );

    // -----------------------------------------------------------------------
    // 8. guard.evaluated -> guardEvaluate action + evaluating glow (INTG-02, INTG-09)
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("guard.evaluated", (event: any) => {
        const { nodes, actions } = store();

        // Find agent node by action.agentId
        const agentNode = nodes.find(
          (n: Node<SwarmBoardNodeData>) =>
            n.data.agentId === event.action?.agentId,
        );

        if (agentNode) {
          const nodeId = agentNode.id;
          const currentStatus = (agentNode.data as SwarmBoardNodeData).status;

          // Evaluating glow pattern (copied from usePolicyEvalBoardBridge)
          const existingTimeout = timeouts.get(nodeId);
          if (existingTimeout != null) {
            clearTimeout(existingTimeout);
          } else {
            // Only save restore status if this is a fresh evaluation
            restoreStatuses.set(
              nodeId,
              currentStatus === "evaluating" ? "running" : currentStatus,
            );
          }

          // Set the node to evaluating status (triggers gold glow ring)
          actions.updateNode(nodeId, { status: "evaluating" });

          // Schedule reset back to previous status after glow duration
          const timeout = setTimeout(() => {
            timeouts.delete(nodeId);
            const restoreTo = restoreStatuses.get(nodeId) ?? "running";
            restoreStatuses.delete(nodeId);
            actions.updateNode(nodeId, { status: restoreTo });
          }, EVAL_GLOW_DURATION_MS);

          timeouts.set(nodeId, timeout);

          // Create receipt node via guardEvaluate action
          actions.guardEvaluate(
            nodeId,
            event.result?.verdict ?? "deny",
            (event.result?.guardResults ?? []).map((g: any) => ({
              guard: g.guard ?? g.guardId ?? "unknown",
              allowed: g.verdict !== "deny",
              duration_ms: g.duration_ms ?? g.durationMs,
            })),
            event.result?.receipt?.signature,
            event.result?.receipt?.publicKey,
          );
        }
      }),
    );

    // -----------------------------------------------------------------------
    // 9 & 10. Shared handler for topology.updated and topology.rebalanced
    // -----------------------------------------------------------------------
    function handleTopologyEvent(topologyState: { type?: string; edges?: Array<{ from: string; to: string }> } | undefined): void {
      const { nodes, edges, actions } = store();
      const topoType = (topologyState?.type ?? "mesh") as Parameters<typeof computeLayout>[2];
      const currentNodes = nodes as Node<SwarmBoardNodeData>[];
      const nextTopologyEdges = buildTopologyEdges(currentNodes, topologyState?.edges);
      const nextEdges = [
        ...edges.filter((edge) => edge.type !== "topology"),
        ...nextTopologyEdges,
      ];

      const result = computeLayout(
        currentNodes,
        nextEdges,
        topoType,
        { width: 1200, height: 800 },
      );

      actions.setEdges(nextEdges);
      actions.topologyLayout(topoType, result.positions);
    }

    // 9. topology.updated (INTG-02)
    unsubs.push(
      events.on("topology.updated", (event: any) => {
        handleTopologyEvent(event.newTopology);
      }),
    );

    // 10. topology.rebalanced (INTG-02)
    unsubs.push(
      events.on("topology.rebalanced", (event: any) => {
        handleTopologyEvent(event.topology);
      }),
    );

    // -----------------------------------------------------------------------
    // Cleanup: unsubscribe all events + clear all glow timeouts
    // -----------------------------------------------------------------------
    return () => {
      unsubs.forEach((fn) => fn());

      for (const timeout of timeouts.values()) {
        clearTimeout(timeout);
      }
      timeouts.clear();
      restoreStatuses.clear();
    };
  }, [engine]);
}
