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
import type { SwarmBoardNodeData, SessionStatus } from "@/features/swarm/swarm-board-types";
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

    // Access the shared event emitter via subscribing through
    // the orchestrator's subsystem accessors (registry, taskGraph, topology).
    // The engine exposes `.on()` via the injected TypedEventEmitter.

    // For event subscriptions we need the events object. The orchestrator
    // stores it privately but all subsystems share the same TypedEventEmitter.
    // We subscribe through getState().engine which IS the orchestrator; the
    // plan instructs us to call engine events. Since the orchestrator does
    // not expose the emitter directly, we leverage the fact that events are
    // emitted by the orchestrator and its subsystems onto the same emitter.
    // The correct approach: re-construct a reference to the shared emitter
    // from one of the exposed subsystems -- but they also don't expose it.
    //
    // RESOLUTION: We subscribe using the orchestrator's event emitter.
    // Since SwarmOrchestrator stores `events` as a private field, we create
    // a lightweight proxy that wraps the emitter. However, looking at the
    // actual code, the TypedEventEmitter is passed to the constructor and
    // stored as `private readonly events`. We can access it by creating
    // a new emitter reference at the provider level. But the plan says to
    // subscribe to engine.events.on(). Since the orchestrator doesn't expose
    // events publicly, the SwarmEngineProvider passes the emitter reference
    // as part of the context. BUT the plan's interface only passes `engine`.
    //
    // The simplest correct approach: The SwarmOrchestrator emits events
    // through the shared TypedEventEmitter. Since subsystems (AgentRegistry,
    // TaskGraph, TopologyManager) also emit onto the same emitter, and the
    // provider has access to all of them, we need the emitter.
    //
    // Looking at the plan again: it says `engine.events.on()`. This suggests
    // the orchestrator should have a public events accessor. Let's check if
    // there's a way to access it. The private field can be accessed via
    // (engine as any).events, but that's fragile.
    //
    // PRACTICAL FIX: Use (engine as any) to access the private events field.
    // This is standard in bridge/integration code and matches how ruflo did it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = (engine as any).events as {
      on: <K extends string>(event: K, handler: (data: any) => void) => () => void;
    };

    if (!events || typeof events.on !== "function") return;

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
    // 3. agent.heartbeat -> setSessionMetadata (INTG-02)
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("agent.heartbeat", (event: any) => {
        const { nodes, actions } = store();

        const node = nodes.find(
          (n: Node<SwarmBoardNodeData>) => n.data.agentId === event.agentId,
        );
        if (!node) return;

        actions.setSessionMetadata(node.id, {
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
              allowed: g.verdict === "allow",
              duration_ms: g.duration_ms ?? g.durationMs,
            })),
            event.result?.receipt?.signature,
            event.result?.receipt?.publicKey,
          );
        }
      }),
    );

    // -----------------------------------------------------------------------
    // 9. topology.updated -> computeLayout + topologyLayout action (INTG-02)
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("topology.updated", (event: any) => {
        const { nodes, edges, actions } = store();

        const result = computeLayout(
          nodes as Node<SwarmBoardNodeData>[],
          edges,
          event.newTopology?.type ?? "mesh",
          { width: 1200, height: 800 },
        );

        actions.topologyLayout(event.newTopology?.type ?? "mesh", result.positions);

        // Create topology edges from event.newTopology.edges
        if (event.newTopology?.edges) {
          for (const topoEdge of event.newTopology.edges) {
            // Map topology node IDs to board node IDs via agentId matching
            const fromNode = nodes.find(
              (n: Node<SwarmBoardNodeData>) =>
                n.data.agentId === topoEdge.from || n.id === topoEdge.from,
            );
            const toNode = nodes.find(
              (n: Node<SwarmBoardNodeData>) =>
                n.data.agentId === topoEdge.to || n.id === topoEdge.to,
            );
            if (fromNode && toNode) {
              actions.addEdge({
                id: `edge-topo-${topoEdge.from}-${topoEdge.to}`,
                source: fromNode.id,
                target: toNode.id,
                type: "topology",
              });
            }
          }
        }
      }),
    );

    // -----------------------------------------------------------------------
    // 10. topology.rebalanced -> same as topology.updated (INTG-02)
    // -----------------------------------------------------------------------
    unsubs.push(
      events.on("topology.rebalanced", (event: any) => {
        const { nodes, edges, actions } = store();

        const result = computeLayout(
          nodes as Node<SwarmBoardNodeData>[],
          edges,
          event.topology?.type ?? "mesh",
          { width: 1200, height: 800 },
        );

        actions.topologyLayout(event.topology?.type ?? "mesh", result.positions);

        // Create topology edges from event.topology.edges
        if (event.topology?.edges) {
          for (const topoEdge of event.topology.edges) {
            const fromNode = nodes.find(
              (n: Node<SwarmBoardNodeData>) =>
                n.data.agentId === topoEdge.from || n.id === topoEdge.from,
            );
            const toNode = nodes.find(
              (n: Node<SwarmBoardNodeData>) =>
                n.data.agentId === topoEdge.to || n.id === topoEdge.to,
            );
            if (fromNode && toNode) {
              actions.addEdge({
                id: `edge-topo-${topoEdge.from}-${topoEdge.to}`,
                source: fromNode.id,
                target: toNode.id,
                type: "topology",
              });
            }
          }
        }
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
